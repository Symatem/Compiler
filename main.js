import { LLVMTypeCache } from './LLVM/Type.js';
import { LLVMBasicBlock } from './LLVM/Value.js';
import { LLVMModule } from './LLVM/Module.js';
import { bundleOperands, operandsToLlvmValues } from './values.js';
import { hashOfOperands, buildLlvmBundle, unbundleAndMixOperands } from './utils.js';
import { primitiveDeferEvaluation, primitiveBundle, primitiveUnbundle,
primitiveDivision, primitiveBinaryInstruction, compileBinaryArithmetic, compileBinaryComparison,
primitiveIf, customOperator } from './primitives.js';
import { throwError, pushStackFrame } from './stackTrace.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export class CompilerContext {
    constructor(ontology) {
        LLVMTypeCache.clear(); // TODO: One cache per context?
        this.ontology = ontology;
        this.typedPlaceholderCache = new Map();
        this.operatorInstanceBySymbol = new Map();
        this.operatorInstanceByHash = new Map();
        this.stackHeight = 0;
        this.logMessages = [];
        this.llvmModule = new LLVMModule('Symatem');
        this.executionNamespaceId =
        this.programNamespaceId =
        this.compilerNamespaceId = this.ontology.registerAdditionalSymbols('Compiler', [
            'Operator',
            'OperatorInstance',
            'Operation',
            'Carrier',
            'Element',
            'Operand',
            'OperandTag',
            'OperandBundle',
            'InputOperandBundle',
            'OutputOperandBundle',

            'SourceOperat',
            'DestinationOperat',
            'SourceOperandTag',
            'DestinationOperandTag',
            'TypedPlaceholder',
            'Constant',

            'PlaceholderEncoding',
            'Zero',
            'One',
            'Two',
            'ThirtyTwo',
            'Vector',
            'Symbol',
            'Boolean',
            'Natural32',
            'Integer32',
            'Float32',

            'Input',
            'OtherInput',
            'Output',

            'DeferEvaluation',
            'Bundle',
            'Unbundle',

            'And',
            'Or',
            'Xor',

            'Addition',
            'Subtraction',
            'Minuend',
            'Subtrahend',
            'Multiplication',
            'Division',
            'Dividend',
            'Divisor',
            'Quotient',
            'Rest',

            'Comparand',
            'Equal',
            'NotEqual',
            'LessThan',
            'LessEqual',
            'GreaterThan',
            'GreaterEqual',

            'If',
            'Condition',
            'Then',
            'Else',
        ]);
        this.ontology.setData(BasicBackend.symbolByName.Zero, 0);
        this.ontology.setData(BasicBackend.symbolByName.One, 1);
        this.ontology.setData(BasicBackend.symbolByName.Two, 2);
        this.ontology.setData(BasicBackend.symbolByName.ThirtyTwo, 32);
        const setupTypedPlaceholder = function(typedPlaceholder, size, encoding, count=BasicBackend.symbolByName.One) {
            const placeholderEncoding = this.ontology.createSymbol(this.compilerNamespaceId);
            this.ontology.setTriple([typedPlaceholder, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.TypedPlaceholder], true);
            this.ontology.setTriple([typedPlaceholder, BasicBackend.symbolByName.PlaceholderEncoding, placeholderEncoding], true);
            this.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.Composite], true);
            this.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Count, BasicBackend.symbolByName.One], true);
            this.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.SlotSize, size], true);
            this.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Default, encoding], true);
            this.typedPlaceholderCache.set(encoding+','+this.ontology.getData(size), typedPlaceholder);
        }.bind(this);
        setupTypedPlaceholder(BasicBackend.symbolByName.Symbol, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.BinaryNumber, BasicBackend.symbolByName.Two);
        setupTypedPlaceholder(BasicBackend.symbolByName.Boolean, BasicBackend.symbolByName.One, BasicBackend.symbolByName.BinaryNumber);
        setupTypedPlaceholder(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.BinaryNumber);
        setupTypedPlaceholder(BasicBackend.symbolByName.Integer32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.TwosComplement);
        setupTypedPlaceholder(BasicBackend.symbolByName.Float32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.IEEE754);
        this.llvmLookupMaps = {
            divisionPrefix: new Map([
                [BasicBackend.symbolByName.BinaryNumber, 'u'],
                [BasicBackend.symbolByName.TwosComplement, 's'],
                [BasicBackend.symbolByName.IEEE754, 'f']
            ]),
            binaryArithmetic: new Map([
                [BasicBackend.symbolByName.And, 'and'],
                [BasicBackend.symbolByName.Or, 'or'],
                [BasicBackend.symbolByName.Xor, 'xor'],
                [BasicBackend.symbolByName.Addition, 'add'],
                [BasicBackend.symbolByName.Subtraction, 'sub'],
                [BasicBackend.symbolByName.Multiplication, 'mul']
            ]),
            binaryComparison: new Map([
                [BasicBackend.symbolByName.Equal, 'eq'],
                [BasicBackend.symbolByName.NotEqual, 'ne'],
                [BasicBackend.symbolByName.LessThan, 'lt'],
                [BasicBackend.symbolByName.LessEqual, 'le'],
                [BasicBackend.symbolByName.GreaterThan, 'gt'],
                [BasicBackend.symbolByName.GreaterEqual, 'ge']
            ]),
            binaryComparisonPrefix: new Map([
                [BasicBackend.symbolByName.BinaryNumber, 'u'],
                [BasicBackend.symbolByName.TwosComplement, 's'],
                [BasicBackend.symbolByName.IEEE754, 'o']
            ])
        };
        this.primitiveLookupMap = new Map([
            [BasicBackend.symbolByName.DeferEvaluation, primitiveDeferEvaluation],
            [BasicBackend.symbolByName.Bundle, primitiveBundle],
            [BasicBackend.symbolByName.Unbundle, primitiveUnbundle],
            [BasicBackend.symbolByName.And, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a&b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
            [BasicBackend.symbolByName.Or, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a|b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
            [BasicBackend.symbolByName.Xor, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a^b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
            [BasicBackend.symbolByName.Addition, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a+b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
            [BasicBackend.symbolByName.Subtraction, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a-b), BasicBackend.symbolByName.Minuend, BasicBackend.symbolByName.Subtrahend)],
            [BasicBackend.symbolByName.Multiplication, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a*b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
            [BasicBackend.symbolByName.Division, primitiveDivision],
            [BasicBackend.symbolByName.Equal, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a==b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
            [BasicBackend.symbolByName.NotEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a!=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
            [BasicBackend.symbolByName.LessThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
            [BasicBackend.symbolByName.LessEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
            [BasicBackend.symbolByName.GreaterThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
            [BasicBackend.symbolByName.GreaterEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
            [BasicBackend.symbolByName.If, primitiveIf],
        ]);
    }

    getLlvmCode() {
        return this.llvmModule.serialize();
    }

    execute(inputOperands, isProgramEntry) {
        const entry = {'inputOperands': inputOperands};
        entry.operator = entry.inputOperands.get(BasicBackend.symbolByName.Operator);
        entry.inputOperands = entry.inputOperands.sorted();
        entry.hash = hashOfOperands(this, entry.inputOperands);
        if(this.operatorInstanceByHash.has(entry.hash))
            return this.operatorInstanceByHash.get(entry.hash);
        entry.symbol = this.ontology.createSymbol(this.executionNamespaceId);
        pushStackFrame(this, entry, 'Begin');
        entry.outputOperands = new Map();
        entry.aux = {
            'llvmBasicBlock': new LLVMBasicBlock(),
            'inputLlvmValues': operandsToLlvmValues(this, entry.inputOperands)
        };
        entry.aux.llvmFunctionParameters = Array.from(entry.aux.inputLlvmValues.values());
        unbundleAndMixOperands(this, entry, 'input');
        entry.inputOperands.delete(BasicBackend.symbolByName.Operator);
        entry.inputOperandBundle = bundleOperands(this, entry.inputOperands);
        entry.aux.inputLlvmValueBundle = buildLlvmBundle(this, entry.aux.llvmBasicBlock, Array.from(entry.aux.inputLlvmValues.values()));
        this.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.OperatorInstance], true);
        this.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.Operator, entry.operator], true);
        this.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.InputOperandBundle, entry.inputOperandBundle], true);
        this.operatorInstanceBySymbol.set(entry.symbol, entry);
        this.operatorInstanceByHash.set(entry.hash, entry);
        if(!entry.operator || entry.operator === BasicBackend.symbolByName.Void)
            throwError(this, entry.symbol, 'Tried calling Void as Operator');
        const primitive = this.primitiveLookupMap.get(entry.operator);
        ((primitive) ? primitive : customOperator)(this, entry);
        if(isProgramEntry) {
            if(entry.aux)
                throwError(this, entry.symbol, 'Encountered recursion cycle which could not be resolved');
            if(entry.llvmFunction) {
                delete entry.llvmFunction.linkage;
                entry.llvmFunction.name = this.ontology.getData(entry.operator);
            }
        }
        return entry;
    }

    createCarrier(destinationOperat, destinationOperandTag, sourceOperat, sourceOperandTag = false) {
        const carrier = this.ontology.createSymbol(this.programNamespaceId);
        this.ontology.setTriple([carrier, BasicBackend.symbolByName.Type,  BasicBackend.symbolByName.Carrier], true);
        this.ontology.setTriple([carrier, BasicBackend.symbolByName.DestinationOperat, destinationOperat], true);
        this.ontology.setTriple([carrier, BasicBackend.symbolByName.DestinationOperandTag, destinationOperandTag], true);
        if(sourceOperandTag !== true && sourceOperandTag !== false) {
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperat, sourceOperat], true);
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperandTag, sourceOperandTag], true);
        } else if(sourceOperandTag) {
            const deferEvaluationOperation = this.ontology.createSymbol(this.programNamespaceId),
                  operator = this.ontology.getSolitary(BasicBackend.symbolByName.Operation, destinationOperat, 0);
            this.ontology.setTriple([operator, BasicBackend.symbolByName.Operation, deferEvaluationOperation], true);
            this.createCarrier(deferEvaluationOperation, BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.DeferEvaluation);
            this.createCarrier(deferEvaluationOperation, BasicBackend.symbolByName.Input, sourceOperat);
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperat, deferEvaluationOperation], true);
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperandTag, BasicBackend.symbolByName.Output], true);
        } else {
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperat, sourceOperat], true);
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperandTag, BasicBackend.symbolByName.Constant], true);
        }
    }

    createOperator(operationCount) {
        const operator = this.ontology.createSymbol(this.programNamespaceId),
              operations = [];
        this.ontology.setTriple([operator, BasicBackend.symbolByName.Type,  BasicBackend.symbolByName.Operator], true);
        for(let i = 0; i < operationCount; ++i) {
            const operation = this.ontology.createSymbol(this.programNamespaceId);
            this.ontology.setTriple([operator, BasicBackend.symbolByName.Operation, operation], true);
            operations.push(operation);
        }
        return [operator, operations];
    }

    createOperandTag(name) {
        const symbol = this.ontology.createSymbol(this.programNamespaceId);
        this.ontology.setData(symbol, name);
        return symbol;
    }
}
