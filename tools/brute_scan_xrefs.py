import sys, struct
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB

TARGETS = {0x8cba9d: "sbox_fwd_openssl", 0x8cbbc9: "sbox_inv_openssl", 0xa5c2b8: "sbox_inv_2nd"}
TOLERANCE = 0x20  # allow the resolved addr to be within this many bytes of a target (struct offsets)

def target_hit(addr):
    for t, name in TARGETS.items():
        if abs(addr - t) <= TOLERANCE:
            return t, name
    return None, None

def main(path):
    f = open(path, "rb")
    elf = ELFFile(f)
    text = elf.get_section_by_name(".text")
    base_addr = text["sh_addr"]
    f.seek(text["sh_offset"])
    code = f.read(text["sh_size"])

    md = Cs(CS_ARCH_ARM, CS_MODE_THUMB)
    md.detail = False

    hits = []
    pos = 0
    n = len(code)
    pending_ldr = {}  # reg -> (literal_value, ldr_addr)

    # linear best-effort sweep, restart on decode failure
    while pos < n:
        chunk = code[pos:pos+4096]
        addr = base_addr + pos
        any_insn = False
        consumed = 0
        for insn in md.disasm(chunk, addr):
            any_insn = True
            consumed = (insn.address - addr) + insn.size
            mnem = insn.mnemonic
            ops = insn.op_str
            if mnem == "ldr" and "[pc," in ops:
                try:
                    reg = ops.split(",")[0].strip()
                    imm_str = ops.split("#")[1].rstrip("]")
                    imm = int(imm_str, 16) if imm_str.startswith("0x") else int(imm_str)
                    lit_addr = ((insn.address + 4) & ~3) + imm
                    lit_off = lit_addr - base_addr
                    if 0 <= lit_off + 4 <= len(code):
                        lit_val = struct.unpack("<I", code[lit_off:lit_off+4])[0]
                        pending_ldr[reg] = (lit_val, insn.address)
                except Exception:
                    pass
            elif mnem == "add" and ops.endswith(", pc") or (mnem == "add" and ", pc" in ops):
                reg = ops.split(",")[0].strip()
                if reg in pending_ldr:
                    lit_val, ldr_addr = pending_ldr[reg]
                    resolved = (lit_val + (insn.address + 4)) & 0xffffffff
                    t, name = target_hit(resolved)
                    if t is not None:
                        hits.append((ldr_addr, insn.address, resolved, t, name))
                    del pending_ldr[reg]
        if not any_insn or consumed == 0:
            pos += 2  # skip a halfword and resync
        else:
            pos += consumed

    print(f"Scan complete. .text size={n} bytes. Hits: {len(hits)}")
    for ldr_addr, add_addr, resolved, t, name in hits:
        print(f"  ldr@0x{ldr_addr:x} add@0x{add_addr:x} -> resolved=0x{resolved:x} target=0x{t:x} ({name})")

if __name__ == "__main__":
    main(sys.argv[1])
