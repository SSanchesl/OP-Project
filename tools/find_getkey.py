import sys
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_ARM

path = sys.argv[1]
target_syms = [
    "Java_org_egret_egretnativeandroid_NativeKey_getKey",
]

f = open(path, "rb")
elf = ELFFile(f)

symtab = elf.get_section_by_name(".dynsym") or elf.get_section_by_name(".symtab")
if symtab is None:
    print("no symbol table found")
    sys.exit(1)

for sym in symtab.iter_symbols():
    if sym.name in target_syms:
        addr = sym["st_value"]
        size = sym["st_size"] or 256
        is_thumb = addr & 1
        real_addr = addr & ~1
        print(f"Symbol {sym.name}: addr=0x{addr:x} size={size} thumb={bool(is_thumb)}")

        # find containing section to compute file offset
        for section in elf.iter_sections():
            if section["sh_addr"] <= real_addr < section["sh_addr"] + section["sh_size"] and section["sh_type"] != "SHT_NOBITS":
                file_off = section["sh_offset"] + (real_addr - section["sh_addr"])
                print(f"  in section {section.name}, file_offset=0x{file_off:x}")
                f.seek(file_off)
                code = f.read(max(size, 512))
                mode = CS_MODE_THUMB if is_thumb else CS_MODE_ARM
                md = Cs(CS_ARCH_ARM, mode)
                md.detail = True
                print("  --- disassembly ---")
                for insn in md.disasm(code, real_addr):
                    print(f"  0x{insn.address:x}: {insn.mnemonic}\t{insn.op_str}")
                break
