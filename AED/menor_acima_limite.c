#include <stdio.h>

void insertionSort(double v[], int n) {
    for (int i = 1; i < n; i++) {
        double chave = v[i];
        int j = i - 1;

        while (j >= 0 && v[j] > chave) {
            v[j + 1] = v[j];
            j--;
        }
        v[j + 1] = chave;
    }
}

/* Com o vetor ordenado, o primeiro valor maior que o limite ja e o menor deles. */
double menorAcima(double v[], int n, double limite) {
    for (int i = 0; i < n; i++) {
        if (v[i] > limite) {
            return v[i];
        }
    }
    return -1; /* nenhum peso acima do limite */
}

int main() {
    double pesos[] = {15, 22, 8, 31, 18};
    int n = 5;
    double limite;

    insertionSort(pesos, n);

    printf("Limite: ");
    scanf("%lf", &limite);

    double resultado = menorAcima(pesos, n, limite);
    if (resultado == -1) {
        printf("Nenhum peso acima de %.2f\n", limite);
    } else {
        printf("Menor peso acima do limite: %.2f\n", resultado);
    }
    return 0;
}
