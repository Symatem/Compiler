import { LLVMFloatType } from './Type.mjs';
import {  LLVMFunction } from './Value.mjs';

export class LLVMInstruction {

}

export class LLVMTerminatoryInstruction extends LLVMInstruction {
}

export class LLVMReturnInstruction extends LLVMTerminatoryInstruction {
    constructor(value) {
        super();
        this.value = value;
    }

    serialize() {
        return (this.value.type.name == 'void')
               ? 'ret void'
               : `ret ${this.value.type.serialize()} ${this.value.serialize()}`;
    }
}

export class LLVMBranchInstruction extends LLVMTerminatoryInstruction {
    constructor(destinationLabel) {
        super();
        this.destinationLabel = destinationLabel;
    }

    serialize() {
        return `br ${this.destinationLabel.type.serialize()} ${this.destinationLabel.serialize()}`;
    }
}

export class LLVMConditionalBranchInstruction extends LLVMTerminatoryInstruction {
    constructor(condition, trueLabel, falseLabel) {
        super();
        this.condition = condition;
        this.trueLabel = trueLabel;
        this.falseLabel = falseLabel;
    }

    serialize() {
        return `br ${this.condition.type.serialize()} ${this.condition.serialize()}, ${this.trueLabel.type.serialize()} ${this.trueLabel.serialize()}, ${this.falseLabel.type.serialize()} ${this.falseLabel.serialize()}`;
    }
}

export class LLVMIndirectBranchInstruction extends LLVMTerminatoryInstruction {
    constructor(destinationValue, destinationLabels) {
        super();
        this.destinationValue = destinationValue;
        this.destinationLabels = destinationLabels;
    }

    serialize() {
        const labels = [];
        for(const destinationLabel of this.destinationLabels)
            labels.push(destinationLabel.serialize());
        return `indirectbr ${this.destinationValue.type.serialize()} ${this.destinationValue.serialize()}, [${labels.join(', ')}]`;
    }
}

export class LLVMSwitchInstruction extends LLVMTerminatoryInstruction {
    constructor(value, defaultLabel, caseValues, caseLabels) {
        super();
        this.value = value;
        this.defaultLabel = defaultLabel;
        this.caseValues = caseValues;
        this.caseLabels = caseLabels;
    }

    serialize() {
        const cases = [];
        this.caseValues.forEach(function(caseValue, index) {
            const caseLabel = this.caseLabels[index];
            cases.push(`${caseValue.type.serialize()} ${caseValue.serialize()}, ${caseLabel.type.serialize()} ${caseLabel.serialize()}`);
        }.bind(this));
        return `switch ${this.value.type.serialize()} ${this.value.serialize()}, ${this.defaultLabel.type.serialize()} ${this.defaultLabel.serialize()} [${cases.join(' ')}]`;
    }
}

// TODO: Exceptions
// LLVMInvokeInstruction
// LLVMResumeInstruction
// LLVMCatchSwitchInstruction
// LLVMCatchReturnInstruction
// LLVMCleanupReturnInstruction

export class LLVMUnreachableInstruction extends LLVMTerminatoryInstruction {
    serialize() {
        return 'unreachable';
    }
}



export class LLVMNonTerminatorInstruction extends LLVMInstruction {
    constructor(result) {
        super();
        this.result = result;
    }
}

// kind: 'add', 'fadd', 'sub', 'fsub', 'mul', 'fmul', 'udiv', 'sdiv', 'fdiv', 'urem', 'srem', 'frem', 'shl', 'lshr', 'ashr', 'and', 'or', 'xor'
export class LLVMBinaryInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, kind, operandL, operandR, attributes = []) {
        super(result);
        this.kind = kind;
        this.operandL = operandL;
        this.operandR = operandR;
        this.attributes = attributes;
    }

    serialize() {
        const attributes = (this.attributes.length > 0) ? ` ${this.attributes.join(' ')}` : '';
        return `${this.kind}${attributes} ${this.result.type.serialize()} ${this.operandL.serialize()}, ${this.operandR.serialize()}`;
    }
}

export class LLVMExtractElementInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, vector, index) {
        super(result);
        this.vector = vector;
        this.index = index;
    }

    serialize() {
        return `extractelement ${this.vector.type.serialize()} ${this.vector.serialize()}, ${this.index.type.serialize()} ${this.index.serialize()}`;
    }
}

export class LLVMInsertElementInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, vector, index, element) {
        super(result);
        this.vector = vector;
        this.index = index;
        this.element = element;
    }

    serialize() {
        return `insertelement ${this.vector.type.serialize()} ${this.vector.serialize()}, ${this.element.type.serialize()} ${this.element.serialize()}, ${this.index.type.serialize()} ${this.index.serialize()}`;
    }
}

export class LLVMShuffleVectorInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, vectorL, vectorR, mask) {
        super(result);
        this.vectorL = vectorL;
        this.vectorR = vectorR;
        this.mask = mask;
    }

    serialize() {
        return `shufflevector ${this.vectorL.type.serialize()} ${this.vectorL.serialize()}, ${this.vectorR.type.serialize()} ${this.vectorR.serialize()}, ${this.mask.type.serialize()} ${this.mask.serialize()}`;
    }
}

export class LLVMExtractValueInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, aggregate, indices) {
        super(result);
        this.aggregate = aggregate;
        this.indices = indices;
    }

    serialize() {
        return `extractvalue ${this.aggregate.type.serialize()} ${this.aggregate.serialize()}, ${this.indices.join(', ')}`;
    }
}

export class LLVMInsertValueInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, aggregate, indices, value) {
        super(result);
        this.aggregate = aggregate;
        this.indices = indices;
        this.value = value;
    }

    serialize() {
        return `insertvalue ${this.aggregate.type.serialize()} ${this.aggregate.serialize()}, ${this.value.type.serialize()} ${this.value.serialize()}, ${this.indices.join(', ')}`;
    }
}

export class LLVMAllocaInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, count, align, addressSpace, attributes = []) {
        super(result);
        this.count = count;
        this.align = align;
        this.addressSpace = addressSpace;
        this.attributes = attributes; // 'inalloca'
    }

    serialize() {
        const attributes = (this.attributes.length > 0) ? ` ${this.attributes.join(' ')}` : '',
              parts = [`alloca${attributes} ${this.result.type.referencedType.serialize()}`];
        if(this.count)
            parts.push(`${this.count.type.serialize()} ${this.count.serialize()}`);
        if(this.align)
            parts.push(`align ${this.align}`);
        if(this.addressSpace)
            parts.push(`addressSpace(${this.addressSpace})`);
        return parts.join(', ');
    }
}

export class LLVMLoadInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, source, align, attributes = []) {
        super(result);
        this.source = source;
        this.align = align;
        this.attributes = attributes; // 'atomic', 'volatile'
    }

    serialize() {
        const attributes = (this.attributes.length > 0) ? ` ${this.attributes.join(' ')}` : '',
              parts = [`load${attributes} ${this.result.type.serialize()}`];
        parts.push(`${this.source.type.serialize()} ${this.source.serialize()}`);
        // if(this.syncscope)
        //     parts.push(`[syncscope("${this.syncscope}")] ${this.ordering}`);
        if(this.align)
            parts.push(`align ${this.align}`);
        // if(this.nontemporal)
        //     parts.push(`!nontemporal !{i32 ${this.nontemporal}}`);
        // if(this.invariantLoad)
        //     parts.push(`!invariant.load !{i32 ${this.invariantLoad}}`);
        // if(this.invariantGroup)
        //     parts.push(`!invariant.group !{i32 ${this.invariantGroup}}`);
        // if(this.nonnull)
        //     parts.push(`!nonnull !{i32 ${this.nonnull}}`);
        // if(this.dereferenceable)
        //     parts.push(`!dereferenceable !{i64 ${this.dereferenceable}}`);
        // if(this.dereferenceable_or_null)
        //     parts.push(`!dereferenceable_or_null !{i64 ${this.dereferenceable_or_null}}`);
        // if(this.alignNode)
        //     parts.push(`!align !{i64 ${this.alignNode}}`);
        return parts.join(', ');
    }
}

export class LLVMStoreInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, value, destination, align, attributes = []) {
        super(result);
        this.value = value;
        this.destination = destination;
        this.align = align;
        this.attributes = attributes; // 'atomic', 'volatile'
    }

    serialize() {
        const attributes = (this.attributes.length > 0) ? ` ${this.attributes.join(' ')}` : '',
              parts = [`store${attributes} ${this.value.type.serialize()} ${this.value.serialize()}`];
        parts.push(`${this.destination.type.serialize()} ${this.destination.serialize()}`);
        // if(this.syncscope)
        //     parts.push(`[syncscope("${this.syncscope}")] ${this.ordering}`);
        if(this.align)
            parts.push(`align ${this.align}`);
        // if(this.nontemporal)
        //     parts.push(`!nontemporal !{i32 ${this.nontemporal}}`);
        // if(this.invariantGroup)
        //     parts.push(`!invariant.group !{i32 ${this.invariantGroup}}`);
        return parts.join(', ');
    }
}

export class LLVMGetElementPointerInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, pointer, indices, attributes = []) {
        super(result);
        this.pointer = pointer;
        this.indices = indices;
        this.attributes = attributes; // 'inbounds'
    }

    serialize() {
        const attributes = (this.attributes.length > 0) ? ` ${this.attributes.join(' ')}` : '',
              parts = [
            `getelementptr${attributes} ${this.pointer.type.referencedType.serialize()}`,
            `${this.pointer.type.serialize()} ${this.pointer.serialize()}`
        ];
        if(this.indices.length > 0)
            this.indices.forEach(function(element) {
                parts.push(`${element.type.serialize()} ${element.serialize()}`);
            }.bind(this));
        else
            parts.push(`${this.indices.type.serialize()} ${this.indices.serialize()}`);
        // inrange
        return parts.join(', ');
    }
}

// TODO: Memory Access and Addressing Operations
// 'fence', 'cmpxchg', 'atomicrmw'

// kind: 'trunc', 'zext', 'sext', 'fptrunc', 'fpext', 'fptoui', 'fptosi', 'uitofp', 'sitofp', 'ptrtoint', 'inttoptr', 'bitcast', 'addrspacecast'
export class LLVMCastInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, kind, value) {
        super(result);
        this.kind = kind;
        this.value = value;
    }

    serialize() {
        return `${this.kind} ${this.value.type.serialize()} ${this.value.serialize()} to ${this.result.type.serialize()}`;
    }
}

// condition: 'eq', 'ne', 'ugt', 'uge', 'ult', 'ule', 'sgt', 'sge', 'slt', 'sle'
// 'true', 'false', 'oeq', 'ogt', 'oge', 'olt', 'ole', 'one', 'ord', 'ueq', 'ugt', 'uge', 'ult', 'ule', 'une', 'uno'
export class LLVMCompareInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, condition, operandL, operandR, fastMathFlags = []) {
        super(result);
        this.condition = condition;
        this.operandL = operandL;
        this.operandR = operandR;
        this.fastMathFlags = fastMathFlags;
        this.kind = (this.operandL.type instanceof LLVMFloatType) ? 'fcmp' : 'icmp';
    }

    serialize() {
        const flags = (this.fastMathFlags.length > 0) ? ` ${this.fastMathFlags.join(' ')}` : '';
        return `${this.kind}${flags} ${this.condition} ${this.operandL.type.serialize()} ${this.operandL.serialize()}, ${this.operandR.serialize()}`;
    }
}

export class LLVMSelectInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, condition, ifTrue, ifFalse) {
        super(result);
        this.condition = condition;
        this.ifTrue = ifTrue;
        this.ifFalse = ifFalse;
    }

    serialize() {
        return `select ${this.condition.type.serialize()} ${this.condition.serialize()}, ${this.ifTrue.type.serialize()} ${this.ifTrue.serialize()}, ${this.ifFalse.type.serialize()} ${this.ifFalse.serialize()}`;
    }
}

export class LLVMPhiInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, caseValues = [], caseLabels = []) {
        super(result);
        this.caseValues = caseValues;
        this.caseLabels = caseLabels;
    }

    serialize() {
        const cases = [];
        this.caseValues.forEach(function(caseValue, index) {
            cases.push(`[${caseValue.serialize()}, ${this.caseLabels[index].serialize()}]`);
        }.bind(this));
        return `phi ${this.result.type.serialize()} ${cases.join(', ')}`;
    }
}

// tailFlag: 'tail', 'musttail', 'notail'
export class LLVMCallInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, func, args, attributes = [], tailFlag, fastMathFlags = []) {
        super(result);
        this.function = func;
        this.arguments = args;
        this.attributes = attributes;
        this.tailFlag = tailFlag;
        this.fastMathFlags = fastMathFlags;
        // this.operandBundles = operandBundles;
    }

    serialize() {
        const parts = [], args = [];
        if(this.tailFlag)
            parts.push(this.tailFlag);
        parts.push('call');
        parts.push.apply(this.fastMathFlags);
        if(this.function instanceof LLVMFunction) {
            if(this.function.callingConvention)
                parts.push(this.function.callingConvention);
            for(const attribute of this.function.returnAttributes)
                parts.push(attribute.serialize());
            parts.push(this.function.returnType.serialize());
        } else
            parts.push(this.function.type.serialize());
        this.arguments.forEach(function(argument, index) {
            if(this.func instanceof LLVMFunction)
                for(const attribute of this.func.parameterAttributes[index])
                    parts.push(attribute.serialize());
            args.push(`${argument.type.serialize()} ${argument.serialize()}`);
        }.bind(this));
        parts.push(`${this.function.serialize()}(${args.join(', ')})`);
        for(const attribute of this.attributes)
            parts.push((attribute.serialize) ? attribute.serialize() : attribute);
        // if(this.operandBundles)
        //     parts.push(`[${operandBundles.join(', ')}]`);
        return parts.join(' ');
    }
}

export class LLVMVaArgInstruction extends LLVMNonTerminatorInstruction {
    constructor(result, list) {
        super(result);
        this.list = list;
    }

    serialize() {
        return `va_arg ${this.list.type.serialize()} ${this.list.serialize()}, ${this.result.type.serialize()}`;
    }
}

// TODO: Other Operations
// 'landingpad', 'catchpad', 'cleanuppad'
