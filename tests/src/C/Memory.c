unsigned int Memory() {
    unsigned int* address = __builtin_alloca(sizeof(unsigned int));
    *address = 1;
    return *address;
}
