export default function(program) {
    const [memoryOperator, memoryOperations] = program.createOperator(3),
          encoding = program.backend.getPairOptionally(program.backend.symbolByName.Natural32, program.backend.symbolByName.PlaceholderEncoding);

    program.backend.setData(memoryOperator, 'Memory');
    program.createCarrier(memoryOperations[0], program.backend.symbolByName.Operator, program.backend.symbolByName.StackAllocate);
    program.createCarrier(memoryOperations[0], program.backend.symbolByName.Input, program.backend.symbolByName.Four);
    program.createCarrier(memoryOperations[1], program.backend.symbolByName.Operator, program.backend.symbolByName.Store);
    program.createCarrier(memoryOperations[1], program.backend.symbolByName.Address, memoryOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(memoryOperations[1], program.backend.symbolByName.Input, program.backend.symbolByName.One);
    program.createCarrier(memoryOperations[2], program.backend.symbolByName.Operator, program.backend.symbolByName.Load);
    program.createCarrier(memoryOperations[2], program.backend.symbolByName.Address, memoryOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(memoryOperations[2], program.backend.symbolByName.PlaceholderEncoding, encoding);
    program.createCarrier(memoryOperator, program.backend.symbolByName.Output, memoryOperations[2], program.backend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(program.backend.symbolByName.Operator, memoryOperator);
    return inputs;
}
