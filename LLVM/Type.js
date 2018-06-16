export const LLVMTypeCache = new Map();

// 'void', 'label', 'token', 'metadata', 'opaque'
export class LLVMType {
    constructor(name) {
        if(LLVMTypeCache.has(name))
            return LLVMTypeCache.get(name);
        LLVMTypeCache.set(name, this);
        this.name = name;
    }

    serialize() {
        return this.name;
    }
}

export class LLVMIntegerType extends LLVMType {
    constructor(length) {
        super(`i${length}`);
        this.length = length;
    }
}

export class LLVMFloatType extends LLVMType {
    constructor(length) {
        switch(length) {
            case 16:
                super('half');
                break;
            case 32:
                super('float');
                break;
            case 64:
                super('double');
                break;
            case 128:
                super('fp128');
                break;
        }
        this.length = length;
    }
}

export class LLVMPointerType extends LLVMType {
    constructor(referencedType) {
        super(`${referencedType.serialize()}*`);
        this.referencedType = referencedType;
    }
}

export class LLVMCompositeType extends LLVMType {
    constructor(name) {
        super(name);
    }
}

export class LLVMVectorType extends LLVMCompositeType {
    constructor(elementCount, referencedType) {
        super(`<${elementCount} x ${referencedType.serialize()}>`);
        this.elementCount = elementCount;
        this.referencedType = referencedType;
    }
}

export class LLVMArrayType extends LLVMCompositeType {
    constructor(elementCount, referencedType) {
        super(`[${elementCount} x ${referencedType.serialize()}]`);
        this.elementCount = elementCount;
        this.referencedType = referencedType;
    }
}

export class LLVMStructureType extends LLVMCompositeType {
    constructor(referencedTypes, packed) {
        const content = `{${referencedTypes.map(type => type.serialize()).join(', ')}}`;
        super((packed) ? `<${content}>` : content);
        this.referencedTypes = referencedTypes;
        this.packed = packed;
    }
}

export class LLVMFunctionType extends LLVMType {
    constructor(returnType, parameterTypes) {
        const parameters = [];
        for(const parameter of parameterTypes)
            parameters.push(parameter.serialize());
        super(`${returnType.serialize()}(${parameters.join(', ')})`);
        this.returnType = returnType;
        this.parameterTypes = parameterTypes;
    }
}
