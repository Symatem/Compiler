function(program) {
    const [memoryOperator, memoryOperations] = program.createOperator(3),
          encoding = program.ontology.getSolitary(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.PlaceholderEncoding);

    program.ontology.setData(memoryOperator, 'Memory');
    program.createCarrier(memoryOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.StackAllocate);
    program.createCarrier(memoryOperations[0], BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Four);
    program.createCarrier(memoryOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Store);
    program.createCarrier(memoryOperations[1], BasicBackend.symbolByName.Address, memoryOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(memoryOperations[1], BasicBackend.symbolByName.Input, BasicBackend.symbolByName.One);
    program.createCarrier(memoryOperations[2], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Load);
    program.createCarrier(memoryOperations[2], BasicBackend.symbolByName.Address, memoryOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(memoryOperations[2], BasicBackend.symbolByName.PlaceholderEncoding, encoding);
    program.createCarrier(memoryOperator, BasicBackend.symbolByName.Output, memoryOperations[2], BasicBackend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(BasicBackend.symbolByName.Operator, memoryOperator);
    return inputs;
}
