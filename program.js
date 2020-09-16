import { SymbolInternals } from '../SymatemJS/SymatemJS.mjs';



export class Program {
    constructor(backend) {
        this.backend = backend;
        this.programNamespaceId = SymbolInternals.identityOfSymbol(backend.createSymbol(backend.metaNamespaceIdentity));
    }

    createCarrier(destinationOperat, destinationOperandTag, sourceOperat, sourceOperandTag = false) {
        const carrier = this.backend.createSymbol(this.programNamespaceId);
        this.backend.setTriple([carrier, this.backend.symbolByName.Type,  this.backend.symbolByName.Carrier], true);
        this.backend.setTriple([carrier, this.backend.symbolByName.DestinationOperat, destinationOperat], true);
        this.backend.setTriple([carrier, this.backend.symbolByName.DestinationOperandTag, destinationOperandTag], true);
        if(sourceOperandTag !== true && sourceOperandTag !== false) {
            this.backend.setTriple([carrier, this.backend.symbolByName.SourceOperat, sourceOperat], true);
            this.backend.setTriple([carrier, this.backend.symbolByName.SourceOperandTag, sourceOperandTag], true);
        } else if(sourceOperandTag) {
            const deferEvaluationOperation = this.backend.createSymbol(this.programNamespaceId),
                  operator = this.backend.getPairOptionally(this.backend.symbolByName.Operation, destinationOperat, 0);
            this.backend.setTriple([operator, this.backend.symbolByName.Operation, deferEvaluationOperation], true);
            this.createCarrier(deferEvaluationOperation, this.backend.symbolByName.Operator, this.backend.symbolByName.DeferEvaluation);
            this.createCarrier(deferEvaluationOperation, this.backend.symbolByName.Input, sourceOperat);
            this.backend.setTriple([carrier, this.backend.symbolByName.SourceOperat, deferEvaluationOperation], true);
            this.backend.setTriple([carrier, this.backend.symbolByName.SourceOperandTag, this.backend.symbolByName.Output], true);
        } else {
            this.backend.setTriple([carrier, this.backend.symbolByName.SourceOperat, sourceOperat], true);
            this.backend.setTriple([carrier, this.backend.symbolByName.SourceOperandTag, this.backend.symbolByName.Constant], true);
        }
    }

    createOperator(operationCount) {
        const operator = this.backend.createSymbol(this.programNamespaceId),
              operations = [];
        this.backend.setTriple([operator, this.backend.symbolByName.Type,  this.backend.symbolByName.Operator], true);
        for(let i = 0; i < operationCount; ++i) {
            const operation = this.backend.createSymbol(this.programNamespaceId);
            this.backend.setTriple([operator, this.backend.symbolByName.Operation, operation], true);
            operations.push(operation);
        }
        return [operator, operations];
    }

    createOperand(value) {
        const symbol = this.backend.createSymbol(this.programNamespaceId);
        this.backend.setData(symbol, value);
        return symbol;
    }
}
