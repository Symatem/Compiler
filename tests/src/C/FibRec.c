unsigned int FibRec(unsigned int x) {
    unsigned int x1 = x-1, x2 = x-2;
    return (x < 2) ? x : FibRec(x2)+FibRec(x1);
}
