function(program) {
    const [allocaOperator, allocaOperations] = program.createOperator(3);

    program.ontology.setData(allocaOperator, 'Alloca');
    program.createCarrier(allocaOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.StackAllocate);
    program.createCarrier(allocaOperations[0], BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Four);
    program.createCarrier(allocaOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Store);
    program.createCarrier(allocaOperations[1], BasicBackend.symbolByName.Address, allocaOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(allocaOperations[1], BasicBackend.symbolByName.Input, BasicBackend.symbolByName.One);
    program.createCarrier(allocaOperations[2], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Load);
    program.createCarrier(allocaOperations[2], BasicBackend.symbolByName.Address, allocaOperations[0], BasicBackend.symbolByName.Output);

    const encoding = program.ontology.getSolitary(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.PlaceholderEncoding);
    program.createCarrier(allocaOperations[2], BasicBackend.symbolByName.PlaceholderEncoding, encoding);
    program.createCarrier(allocaOperator, BasicBackend.symbolByName.Output, allocaOperations[2], BasicBackend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(BasicBackend.symbolByName.Operator, allocaOperator);
    return inputs;
}
