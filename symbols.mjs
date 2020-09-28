import { primitiveDeferEvaluation, primitiveBundle, primitiveUnbundle,
primitiveStackAllocate, primitiveLoad, primitiveStore, primitiveConversion,
primitiveDivision, primitiveBinaryInstruction, compileBitShift, compileBinaryArithmetic, compileBinaryComparison,
primitiveIf } from './primitives.mjs';


export const typedPlaceholderCache = new Map();
export let llvmLookupMaps, primitiveLookupMap;
export function initializeBackend(backend) {
    backend.initPredefinedSymbols();
    if(backend.symbolByName.Compiler)
        return;
    const namespaceId = backend.registerNamespaces({'Compiler': [
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
        'Four',
        'Eight',
        'Sixteen',
        'ThirtyTwo',
        'SixtyFour',
        'Vector',
        'Pointer',
        'Symbol',
        'Boolean',
        'Natural32',
        'Integer32',
        'Float32',
        'Natural64',
        'Integer64',
        'Float64',

        'Input',
        'OtherInput',
        'Output',

        'DeferEvaluation',
        'Bundle',
        'Unbundle',

        'StackAllocate',
        'Load',
        'Store',
        'Address',
        'NumericConversion',
        'Reinterpretation',

        'MultiplyByPowerOfTwo',
        'DivideByPowerOfTwo',
        'Exponent',
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
    ]}).Compiler;
    backend.setData(backend.symbolByName.Zero, 0);
    backend.setData(backend.symbolByName.One, 1);
    backend.setData(backend.symbolByName.Two, 2);
    backend.setData(backend.symbolByName.Four, 4);
    backend.setData(backend.symbolByName.Eight, 8);
    backend.setData(backend.symbolByName.Sixteen, 16);
    backend.setData(backend.symbolByName.ThirtyTwo, 32);
    backend.setData(backend.symbolByName.SixtyFour, 64);
    function setupTypedPlaceholder(typedPlaceholder, size, encoding, count=backend.symbolByName.One) {
        const placeholderEncoding = backend.createSymbol(namespaceId);
        backend.setTriple([typedPlaceholder, backend.symbolByName.Type, backend.symbolByName.TypedPlaceholder], true);
        backend.setTriple([typedPlaceholder, backend.symbolByName.PlaceholderEncoding, placeholderEncoding], true);
        backend.setTriple([placeholderEncoding, backend.symbolByName.Type, backend.symbolByName.Composite], true);
        if(count != backend.symbolByName.Void)
            backend.setTriple([placeholderEncoding, backend.symbolByName.Count, count], true);
        backend.setTriple([placeholderEncoding, backend.symbolByName.SlotSize, size], true);
        backend.setTriple([placeholderEncoding, backend.symbolByName.Default, encoding], true);
        typedPlaceholderCache.set(encoding+','+backend.getData(size), typedPlaceholder);
    }
    setupTypedPlaceholder(backend.symbolByName.Pointer, backend.symbolByName.Eight, backend.symbolByName.BinaryNumber, backend.symbolByName.Void);
    setupTypedPlaceholder(backend.symbolByName.Symbol, backend.symbolByName.ThirtyTwo, backend.symbolByName.BinaryNumber, backend.symbolByName.Two);
    setupTypedPlaceholder(backend.symbolByName.Boolean, backend.symbolByName.One, backend.symbolByName.BinaryNumber);
    setupTypedPlaceholder(backend.symbolByName.Natural32, backend.symbolByName.ThirtyTwo, backend.symbolByName.BinaryNumber);
    setupTypedPlaceholder(backend.symbolByName.Integer32, backend.symbolByName.ThirtyTwo, backend.symbolByName.TwosComplement);
    setupTypedPlaceholder(backend.symbolByName.Float32, backend.symbolByName.ThirtyTwo, backend.symbolByName.IEEE754);
    setupTypedPlaceholder(backend.symbolByName.Natural64, backend.symbolByName.SixtyFour, backend.symbolByName.BinaryNumber);
    setupTypedPlaceholder(backend.symbolByName.Integer64, backend.symbolByName.SixtyFour, backend.symbolByName.TwosComplement);
    setupTypedPlaceholder(backend.symbolByName.Float64, backend.symbolByName.SixtyFour, backend.symbolByName.IEEE754);
    llvmLookupMaps = {
        divisionPrefix: new Map([
            [backend.symbolByName.BinaryNumber, 'u'],
            [backend.symbolByName.TwosComplement, 's'],
            [backend.symbolByName.IEEE754, 'f']
        ]),
        binaryArithmetic: new Map([
            [backend.symbolByName.And, 'and'],
            [backend.symbolByName.Or, 'or'],
            [backend.symbolByName.Xor, 'xor'],
            [backend.symbolByName.Addition, 'add'],
            [backend.symbolByName.Subtraction, 'sub'],
            [backend.symbolByName.Multiplication, 'mul']
        ]),
        binaryComparison: new Map([
            [backend.symbolByName.Equal, 'eq'],
            [backend.symbolByName.NotEqual, 'ne'],
            [backend.symbolByName.LessThan, 'lt'],
            [backend.symbolByName.LessEqual, 'le'],
            [backend.symbolByName.GreaterThan, 'gt'],
            [backend.symbolByName.GreaterEqual, 'ge']
        ]),
        binaryComparisonPrefix: new Map([
            [backend.symbolByName.BinaryNumber, 'u'],
            [backend.symbolByName.TwosComplement, 's'],
            [backend.symbolByName.IEEE754, 'o']
        ])
    };
    primitiveLookupMap = new Map([
        [backend.symbolByName.DeferEvaluation, primitiveDeferEvaluation],
        [backend.symbolByName.Bundle, primitiveBundle],
        [backend.symbolByName.Unbundle, primitiveUnbundle],
        [backend.symbolByName.StackAllocate, primitiveStackAllocate],
        [backend.symbolByName.Load, primitiveLoad],
        [backend.symbolByName.Store, primitiveStore],
        [backend.symbolByName.NumericConversion, primitiveConversion.bind(undefined, true)],
        [backend.symbolByName.Reinterpretation, primitiveConversion.bind(undefined, false)],
        [backend.symbolByName.MultiplyByPowerOfTwo, primitiveBinaryInstruction.bind(undefined, compileBitShift, (a, b) => (a<<b), backend.symbolByName.Input, backend.symbolByName.Exponent)],
        [backend.symbolByName.DivideByPowerOfTwo, primitiveBinaryInstruction.bind(undefined, compileBitShift, (a, b) => (a>>b), backend.symbolByName.Input, backend.symbolByName.Exponent)],
        [backend.symbolByName.And, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a&b), backend.symbolByName.Input, backend.symbolByName.OtherInput)],
        [backend.symbolByName.Or, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a|b), backend.symbolByName.Input, backend.symbolByName.OtherInput)],
        [backend.symbolByName.Xor, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a^b), backend.symbolByName.Input, backend.symbolByName.OtherInput)],
        [backend.symbolByName.Addition, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a+b), backend.symbolByName.Input, backend.symbolByName.OtherInput)],
        [backend.symbolByName.Subtraction, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a-b), backend.symbolByName.Minuend, backend.symbolByName.Subtrahend)],
        [backend.symbolByName.Multiplication, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a*b), backend.symbolByName.Input, backend.symbolByName.OtherInput)],
        [backend.symbolByName.Division, primitiveDivision],
        [backend.symbolByName.Equal, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a==b), backend.symbolByName.Input, backend.symbolByName.Comparand)],
        [backend.symbolByName.NotEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a!=b), backend.symbolByName.Input, backend.symbolByName.Comparand)],
        [backend.symbolByName.LessThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<b), backend.symbolByName.Input, backend.symbolByName.Comparand)],
        [backend.symbolByName.LessEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<=b), backend.symbolByName.Input, backend.symbolByName.Comparand)],
        [backend.symbolByName.GreaterThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>b), backend.symbolByName.Input, backend.symbolByName.Comparand)],
        [backend.symbolByName.GreaterEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>=b), backend.symbolByName.Input, backend.symbolByName.Comparand)],
        [backend.symbolByName.If, primitiveIf],
    ]);
}
