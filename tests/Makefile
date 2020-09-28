LLVM_BIN = ../../../llvm/bin
COMPILER_FLAGS := -fno-exceptions -fno-stack-protector -fomit-frame-pointer -fno-rtti -ffreestanding -Wall -Wsign-compare

all: build/LLVM build/ASM compileC compileSymatem optimizeSymatem compileAsm
build/LLVM build/ASM:
	mkdir -p build/LLVM build/ASM

SRC_C := $(wildcard src/C/*.c)
LLVM_C := $(SRC_C:src/C/%.c=build/LLVM/%_C.ll)
compileC: $(LLVM_C)
build/LLVM/%_C.ll: src/C/%.c
	$(LLVM_BIN)/clang -target arm64--unknown-macho $(COMPILER_FLAGS) -O3 -S -emit-llvm -o $@ $^

SRC_SYMATEM := $(wildcard src/JS/*.mjs)
LLVM_SYMATEM_RAW := $(SRC_SYMATEM:src/JS/%.mjs=build/LLVM/%_SymatemRaw.ll)
compileSymatem: $(LLVM_SYMATEM_RAW)
build/LLVM/%_SymatemRaw.ll: src/JS/%.mjs
	node --experimental-modules compile.mjs $^ $@

LLVM_SYMATEM := $(LLVM_SYMATEM_RAW:build/LLVM/%_SymatemRaw.ll=build/LLVM/%_Symatem.ll)
optimizeSymatem: $(LLVM_SYMATEM)
build/LLVM/%_Symatem.ll: build/LLVM/%_SymatemRaw.ll
	$(LLVM_BIN)/opt -mtriple arm64--unknown-macho -O3 -S -strip -o $@ $^

SRC_LL := $(LLVM_C) $(LLVM_SYMATEM)
ASM := $(SRC_LL:build/LLVM/%.ll=build/ASM/%.S)
compileAsm: $(ASM)
build/ASM/%.S: build/LLVM/%.ll
	$(LLVM_BIN)/llc -march arm64 -o $@ $^
