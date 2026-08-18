import sys
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB

def main(path, target_addr):
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
    while pos < n:
        chunk = code[pos:pos+4096]
        addr = base_addr + pos
        any_insn = False
        consumed = 0
        for insn in md.disasm(chunk, addr):
            any_insn = True
            consumed = (insn.address - addr) + insn.size
            if insn.mnemonic in ("bl", "blx", "b", "bx") and insn.op_str.startswith("#0x"):
                try:
                    tgt = int(insn.op_str[1:], 16)
                    if tgt == target_addr or tgt == (target_addr | 1) or tgt == (target_addr & ~1):
                        hits.append((insn.address, insn.mnemonic))
                except Exception:
                    pass
        if not any_insn or consumed == 0:
            pos += 2
        else:
            pos += consumed

    print(f"Callers of 0x{target_addr:x}: {len(hits)}")
    for addr, mnem in hits:
        print(f"  0x{addr:x}: {mnem}")

if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2], 16))
