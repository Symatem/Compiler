import { LLVMTypeCache } from './LLVM/Type.js';
import { LLVMAlias } from './LLVM/Value.js';
import { LLVMModule } from './LLVM/Module.js';
import { encodingToLlvmType } from './values.js';
import { execute } from './execution.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export class CompilerContext {
    constructor(ontology) {
        LLVMTypeCache.clear(); // TODO: One cache per context?
        this.ontology = ontology;
        this.typedPlaceholderCache = new Map();
        this.operatorInstanceBySymbol = new Map();
        this.operatorInstanceByHash = new Map();
        this.llvmModule = new LLVMModule('Symatem');
        this.executionNamespaceId =
        this.programNamespaceId =
        this.compilerNamespaceId = this.ontology.registerAdditionalSymbols('Compiler', [
            'Operator',
            'Operation',
            // 'Operand',
            // 'Carrier',
            'CarrierBundle',
            'Constant',
            'InputOperands',
            'OutputOperands',

            'SourceOperat',
            'DestinationOperat',
            'SourceOperandTag',
            'DestinationOperandTag',
            'TypedPlaceholder',

            'PlaceholderEncoding',
            'One',
            'Two',
            'ThirtyTwo',
            'Vector',
            'Symbol',
            'Boolean',
            'Natural32',
            'Integer32',
            'Float32',

            'InputL',
            'InputR',
            'Input',
            'Output',

            'DeferEvaluation',
            'Addition',
            'Subtraction',
            'Multiplication',
            'Equal',
            'NotEqual',
            'LessThan',
            'LessEqual',
            'GreaterThan',
            'GreaterEqual',

            'If',
            'Then',
            'Else',
            'Condition',
        ]);
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
            this.typedPlaceholderCache.set(encodingToLlvmType(this, placeholderEncoding, size*count).serialize(), typedPlaceholder);
        }.bind(this);
        setupTypedPlaceholder(BasicBackend.symbolByName.Symbol, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.BinaryNumber, BasicBackend.symbolByName.Two);
        setupTypedPlaceholder(BasicBackend.symbolByName.Boolean, BasicBackend.symbolByName.One, BasicBackend.symbolByName.BinaryNumber);
        setupTypedPlaceholder(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.BinaryNumber);
        setupTypedPlaceholder(BasicBackend.symbolByName.Integer32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.TwosComplement);
        setupTypedPlaceholder(BasicBackend.symbolByName.Float32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.IEEE754);
        this.llvmLookupMaps = {
            binaryArithmetic: new Map([
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
    }

    llvmCode() {
        return this.llvmModule.serialize();
    }

    createCarrier(destinationOperat, destinationOperandTag, sourceOperat, sourceOperandTag = false) {
        const carrier = this.ontology.createSymbol(this.programNamespaceId);
        // this.ontology.setTriple([carrier, BasicBackend.symbolByName.Type,  BasicBackend.symbolByName.Carrier], true);
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
        // this.ontology.setTriple([operator, BasicBackend.symbolByName.Type,  BasicBackend.symbolByName.Operator], true);
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

    execute(inputs, exportUsingAlias) {
        const entry = execute(this, inputs);
        if(entry.aux)
            throw new Error('Encountered recursion cycle which could not be resolved');
        if(exportUsingAlias && entry.llvmFunction)
            this.llvmModule.aliases.push(new LLVMAlias(this.ontology.getData(entry.operator), entry.llvmFunction));
        return entry.outputOperands;
    }
}
