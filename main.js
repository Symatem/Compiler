import { LLVMTypeCache } from './LLVM/Type.js';
import { LLVMBasicBlock } from './LLVM/Value.js';
import { LLVMModule } from './LLVM/Module.js';
import { bundleOperands, operandsToLlvmValues } from './values.js';
import { hashOfOperands, buildLlvmBundle, unbundleAndMixOperands, customOperator } from './utils.js';
import { throwError, pushStackFrame } from './stackTrace.js';
import { typedPlaceholderCache, primitiveLookupMap, initializeOntology } from './symbols.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export class CompilerContext {
    constructor(ontology) {
        initializeOntology(ontology);
        this.ontology = ontology;
        this.typedPlaceholderCache = new Map(typedPlaceholderCache);
        this.operatorInstanceBySymbol = new Map();
        this.operatorInstanceByHash = new Map();
        this.stackHeight = 0;
        this.logMessages = [];
        this.llvmModule = new LLVMModule('Symatem');
        this.namespaceId = BasicBackend.identityOfSymbol(this.ontology.createSymbol(BasicBackend.identityOfSymbol(BasicBackend.symbolByName.Namespaces)));
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
        entry.symbol = this.ontology.createSymbol(this.namespaceId);
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
        const primitive = primitiveLookupMap.get(entry.operator);
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
}
