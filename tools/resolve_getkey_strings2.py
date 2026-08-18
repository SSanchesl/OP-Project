import sys, struct
from elftools.elf.elffile import ELFFile

path = sys.argv[1]
f = open(path, "rb")
elf = ELFFile(f)

sections = list(elf.iter_sections())

def find_section(vaddr):
    for s in sections:
        if s["sh_addr"] != 0 and s["sh_addr"] <= vaddr < s["sh_addr"] + s["sh_size"]:
            return s
    return None

def read_bytes(vaddr, n):
    s = find_section(vaddr)
    if s is None:
        return None, "no section"
    if s["sh_type"] == "SHT_NOBITS":
        return b"\x00" * n, f".bss ({s.name}) -> zero-initialized"
    off = s["sh_offset"] + (vaddr - s["sh_addr"])
    f.seek(off)
    return f.read(n), s.name

def read_word(vaddr):
    data, _ = read_bytes(vaddr, 4)
    return struct.unpack("<I", data)[0]

def read_cstr(vaddr, maxlen=256):
    data, secname = read_bytes(vaddr, maxlen)
    if data is None:
        return None, secname
    end = data.find(b"\x00")
    if end == -1:
        end = maxlen
    return data[:end], secname

text = elf.get_section_by_name(".text")

def lit(instr_addr, imm):
    base = ((instr_addr + 4) & ~3) + imm
    return read_word(base)

def addpc(instr_addr, offset):
    return (offset + (instr_addr + 4)) & 0xffffffff

off1 = lit(0xba660, 0x1c)
addr1 = addpc(0xba662, off1)   # buffer A address (also flag: first byte != 0 means "set")
s1, sec1 = read_cstr(addr1)
print(f"addr_A = 0x{addr1:x}  (section {sec1})  first_byte={s1[0] if s1 else None}  str={s1!r}")

off2 = lit(0xba668, 0x18)
addr2 = addpc(0xba66c, off2)   # buffer B address (fallback default)
s2, sec2 = read_cstr(addr2)
print(f"addr_B = 0x{addr2:x}  (section {sec2})  first_byte={s2[0] if s2 else None}  str={s2!r}")
