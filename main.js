import { LLVMTypeCache } from './LLVM/Type.js';
import { LLVMAlias } from './LLVM/Value.js';
import { LLVMModule } from './LLVM/Module.js';
import { execute } from './execution.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export class CompilerContext {
    constructor(ontology) {
        LLVMTypeCache.clear(); // TODO: One cache per context?
        this.ontology = ontology;
        this.preDefRuntimeValues = new Map();
        this.operatorInstanceBySymbol = new Map();
        this.operatorInstanceByName = new Map();
        this.llvmConstants = new Map();
        this.llvmModule = new LLVMModule('Symatem');
        this.executionNamespaceId =
        this.programNamespaceId =
        this.compilerNamespaceId = this.ontology.registerAdditionalSymbols('Compiler', [
            'Operator',
            'Operation',
            // 'Operand',
            // 'Carrier',
            'SourceOperand',
            'SourceOperat',
            'DestinationOperat',
            'SourceOperandTag',
            'DestinationOperandTag',
            'Carry',
            'RuntimeValue',

            'RuntimeEncoding',
            'One',
            'Two',
            'ThirtyTwo',
            'Vector',
            'Boolean',
            'Natural32',
            'Integer32',
            'Float32',

            'InputL',
            'InputR',
            'Input',
            'Output',

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
        const setupRuntimeValue = function(preDefRuntimeValue, size, encoding) {
            const runtimeEncoding = this.ontology.createSymbol(this.compilerNamespaceId);
            this.ontology.setTriple([preDefRuntimeValue, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.RuntimeValue], true);
            this.ontology.setTriple([preDefRuntimeValue, BasicBackend.symbolByName.RuntimeEncoding, runtimeEncoding], true);
            this.ontology.setTriple([runtimeEncoding, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.Composite], true);
            this.ontology.setTriple([runtimeEncoding, BasicBackend.symbolByName.Count, BasicBackend.symbolByName.One], true);
            this.ontology.setTriple([runtimeEncoding, BasicBackend.symbolByName.SlotSize, size], true);
            this.ontology.setTriple([runtimeEncoding, BasicBackend.symbolByName.Default, encoding], true);
            this.preDefRuntimeValues.set(encoding+','+this.ontology.getData(size), preDefRuntimeValue);
        }.bind(this);
        setupRuntimeValue(BasicBackend.symbolByName.Boolean, BasicBackend.symbolByName.One, BasicBackend.symbolByName.BinaryNumber);
        setupRuntimeValue(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.BinaryNumber);
        setupRuntimeValue(BasicBackend.symbolByName.Integer32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.TwosComplement);
        setupRuntimeValue(BasicBackend.symbolByName.Float32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.IEEE754);
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
        this.ontology.setTriple([carrier, BasicBackend.symbolByName.DestinationOperat, destinationOperat], true);
        this.ontology.setTriple([carrier, BasicBackend.symbolByName.DestinationOperandTag, destinationOperandTag], true);
        if(sourceOperandTag === true || sourceOperandTag === false) {
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperand, sourceOperat], true);
            if(sourceOperandTag)
                this.ontology.setTriple([carrier, BasicBackend.symbolByName.Carry, BasicBackend.symbolByName.RuntimeValue], true);
        } else {
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperat, sourceOperat], true);
            this.ontology.setTriple([carrier, BasicBackend.symbolByName.SourceOperandTag, sourceOperandTag], true);
        }
    }

    createOperator(operationCount) {
        const operator = this.ontology.createSymbol(this.programNamespaceId),
              operations = [];
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