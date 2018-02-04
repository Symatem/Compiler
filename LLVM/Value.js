export class LLVMValue {
    constructor(type, name, global) {
        this.type = type;
        this.name = name;
        this.global = global;
    }

    serialize() {
        return ((this.global) ? '@' : '%') + this.name;
    }
}

export class LLVMConstant extends LLVMValue {
    constructor(type, name, global) {
        super(type, name, global);
    }
}

export class LLVMLiteralConstant extends LLVMConstant {
    constructor(type, value = 'undef') { // 'zeroinitializer'
        super(type);
        this.value = value;
    }

    serialize() {
        return this.value;
    }
}

export class LLVMTextConstant extends LLVMLiteralConstant {
    constructor(type, value) {
        value = encodeURI(value).replace('%', '\\');
        super(type, `c"${value}"`);
    }
}

import { LLVMType, LLVMVectorType, LLVMArrayType, LLVMStructureType, LLVMFunctionType } from './Type.js';
export class LLVMCompositeConstant extends LLVMConstant {
    constructor(type, elements) {
        super(type);
        this.elements = elements;
        if(type instanceof LLVMVectorType)
            this.brackets = '<>';
        else if(type instanceof LLVMArrayType)
            this.brackets = '[]';
        else if(type instanceof LLVMStructureType)
            this.brackets = (type.packed) ? ['<{', '}>'] : '{}';
        else
            console.error('Invalid type');
    }

    serialize() {
        const parts = [];
        for(const element of this.elements)
            parts.push(`${element.type.serialize()} ${element.serialize()}`);
        return `${this.brackets[0]}${parts.join(', ')}${this.brackets[1]}`;
    }
}

import { LLVMTerminatoryInstruction } from './Instruction.js';
export class LLVMBasicBlock extends LLVMConstant {
    constructor(name, instructions = []) {
        super(new LLVMType('label'), name);
        this.instructions = instructions;
    }

    serializeDeclaration(generateLocalName) {
        const name = (this.name) ? `${this.name}:\n` : '';
        if(!this.name)
            this.name = generateLocalName();
        const instructions = [];
        for(const instruction of this.instructions) {
            if(instruction instanceof LLVMTerminatoryInstruction) {
                if(this.instructions.indexOf(instruction) != this.instructions.length-1)
                    console.error('LLVMBasicBlock: LLVMTerminatoryInstruction is not the last one', this, instruction);
                instructions.push(`\t${instruction.serialize()}`);
            } else {
                if(!instruction.result.name)
                    instruction.result.name = generateLocalName();
                instructions.push(`\t${instruction.result.serialize()} = ${instruction.serialize()}`);
            }
        }
        return `${name}${instructions.join('\n')}`;
    }
}

// http://llvm.org/docs/LangRef.html#functions

// Linkage
// ['private', 'internal', 'available_externally', 'linkonce', 'weak', 'common', 'appending', 'extern_weak', 'linkonce_odr', 'weak_odr', 'external']

// Visibility
// ['default', 'hidden', 'protected']

// DLL Storage Class
// ['dllimport', 'dllexport']

// Thread Local Storage Models
// ['localdynamic', 'initialexec', 'localexec']

// Calling Convention
// ['ccc', 'fastcc', 'coldcc', 'cc 10', 'cc 11', 'webkit_jscc', 'anyregcc', 'preserve_mostcc', 'preserve_allcc', 'cxx_fast_tlscc', 'swiftcc', 'cc <n>']

// Function Attribute
// ['unnamed_addr', 'local_unnamed_addr', 'alignstack(<n>)', 'allocsize(<EltSizeParam>[, <NumEltsParam>])', 'alwaysinline', 'builtin', 'cold', 'convergent', 'inaccessiblememonly', 'inaccessiblemem_or_argmemonly', 'inlinehint', 'jumptable', 'minsize', 'naked', 'nobuiltin', 'noduplicate', 'noimplicitfloat', 'noinline', 'nonlazybind', 'noredzone', 'noreturn', 'norecurse', 'nounwind', 'optnone', 'optsize', 'patchable-function', 'prologue-short-redirect', 'prologue-short-redirect', 'probe-stack', 'readnone', 'readonly', 'stack-probe-size', 'writeonly', 'argmemonly', 'returns_twice', 'safestack', 'sanitize_address', 'sanitize_memory', 'sanitize_thread', 'speculatable', 'ssp', 'sspreq', 'sspstrong', 'thunk', 'uwtable']

// Parameter Attribute
// ['zeroext', 'signext', 'inreg', 'byval', 'inalloca', 'sret', 'align <n>', 'noalias', 'nocapture', 'nest', 'returned', 'nonnull', 'dereferenceable(<n>)', 'dereferenceable_or_null(<n>)', 'swiftself', 'swifterror']

export class LLVMFunction extends LLVMConstant {
    constructor(name, returnType, parameters, basicBlocks = []) {
        super(new LLVMFunctionType(returnType, parameters.map((parameter) => parameter.type)), name);
        this.global = true;
        this.returnType = returnType;
        this.parameters = parameters;
        this.attributes = [];
        this.returnAttributes = [];
        this.parameterAttributes = [];
        for(const parameterType of parameters)
            this.parameterAttributes.push([]);
        this.basicBlocks = basicBlocks;
    }

    serializeDeclaration() {
        let nextLocalName = 0;
        function generateLocalName() {
            return nextLocalName++;
        }
        const parts = ['define'],
              parameters = [],
              basicBlocks = [];
        if(this.linkage)
            parts.push(this.linkage);
        // if(this.preemptionSpecifier)
        //     parts.push(this.preemptionSpecifier);
        if(this.visibility)
            parts.push(this.visibility);
        // if(this.dllStorageClass)
        //     parts.push(this.dllStorageClass);
        if(this.callingConvention)
            parts.push(this.callingConvention);
        for(const attribute of this.returnAttributes)
            parts.push(attribute.serialize());
        parts.push(this.returnType.serialize());
        for(const i in this.parameters) {
            for(const attribute of this.parameterAttributes[i])
                parts.push(attribute.serialize());
            if(this.parameters[i].name)
                parameters.push(`${this.parameters[i].type.serialize()} ${this.parameters[i].serialize()}`);
            else {
                this.parameters[i].name = generateLocalName();
                parameters.push(`${this.parameters[i].type.serialize()}`);
            }
        }
        parts.push(`${this.serialize()}(${parameters.join(', ')})`);
        for(const attribute of this.attributes)
            parts.push(attribute.serialize());
        if(this.section)
            parts.push(`section ${this.section}`);
        // if(this.comdat)
        //     parts.push('comdat('+this.comdat+')');
        if(this.align)
            parts.push(`align ${this.align}`);
        // if(this.gc)
        //     parts.push('gc '+this.gc);
        // if(this.prefix)
        //     parts.push('prefix '+this.gc);
        // if(this.prologue)
        //     parts.push('prologue '+this.gc);
        // if(this.personality)
        //     parts.push('personality '+this.gc);
        // if(this.)
        //     parts.push('(!name !N)*');
        if(this.basicBlocks) {
            for(const basicBlock of this.basicBlocks)
                basicBlocks.push(basicBlock.serializeDeclaration(generateLocalName));
            parts.push(`{\n${basicBlocks.join('\n')}\n}\n`);
        }
        return parts.join(' ');
    }
}

export class LLVMAlias extends LLVMConstant {
    constructor(name, func) {
        super(func.type, name, true);
        this.func = func;
        this.attributes = [];
    }

    serializeDeclaration() {
        const parts = ['alias'];
        if(this.linkage)
            parts.push(this.linkage);
        // if(this.preemptionSpecifier)
        //     parts.push(this.preemptionSpecifier);
        if(this.visibility)
            parts.push(this.visibility);
        // if(this.dllStorageClass)
        //     parts.push(this.dllStorageClass);
        // if(this.threadLocal)
        //     parts.push(this.threadLocal);
        for(const attribute of this.attributes)
            parts.push(attribute.serialize());
        return `${this.serialize()} = ${parts.join(' ')} ${this.type.serialize()}, ${this.type.serialize()}* ${this.func.serialize()}`;
    }
}
