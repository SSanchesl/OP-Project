import sys, struct
from elftools.elf.elffile import ELFFile

path = sys.argv[1]
f = open(path, "rb")
elf = ELFFile(f)

text = elf.get_section_by_name(".text")
text_addr = text["sh_addr"]
text_off = text["sh_offset"]

def v2o(vaddr):
    return text_off + (vaddr - text_addr)

def read_word(vaddr):
    f.seek(v2o(vaddr))
    return struct.unpack("<I", f.read(4))[0]

def read_cstr(vaddr, maxlen=128):
    f.seek(v2o(vaddr))
    data = f.read(maxlen)
    end = data.find(b"\x00")
    if end == -1:
        end = maxlen
    return data[:end]

def read_byte(vaddr):
    f.seek(v2o(vaddr))
    return f.read(1)[0]

# instr at 0xba660 (thumb): ldr r1, [pc, #0x1c]
# literal pool addr = align4(0xba660+4) + 0x1c
lit1 = ((0xba660 + 4) & ~3) + 0x1c
off1 = read_word(lit1)
# add r1, pc at 0xba662 : pc = 0xba662+4
addr1 = (off1 + (0xba662 + 4)) & 0xffffffff
print(f"flag1 byte addr = 0x{addr1:x}  value = {read_byte(addr1)}")

# instr at 0xba668: ldr r2, [pc, #0x18]
lit2 = ((0xba668 + 4) & ~3) + 0x18
off2 = read_word(lit2)
# add r2, pc at 0xba66c: pc = 0xba66c+4
addr2 = (off2 + (0xba66c + 4)) & 0xffffffff
print(f"flag2 byte addr = 0x{addr2:x}  value = {read_byte(addr2)}")

# instr at 0xba66a: ldr r1, [pc, #0x1c]
lit3 = ((0xba66a + 4) & ~3) + 0x1c
off3 = read_word(lit3)
# add r1, pc at 0xba66e: pc = 0xba66e+4
addr3 = (off3 + (0xba66e + 4)) & 0xffffffff
print(f"string1 (r1, default) addr = 0x{addr3:x}  str = {read_cstr(addr3)!r}")

print(f"string2 (r2, at flag1) addr = 0x{addr1:x}... wait that's the flag byte itself")
print(f"string via r2 (addr2) addr = 0x{addr2:x}  str = {read_cstr(addr2)!r}")
