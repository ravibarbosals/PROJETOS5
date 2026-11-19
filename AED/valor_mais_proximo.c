#include <stdio.h>

void selectionSort(double v[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int menor = i;
        
        for (int j = i + 1; j < n; j++) {
            if (v[j] < v[menor]) {
                menor = j;
            }
        }
        double aux = v[i];
        v[i] = v[menor];
        v[menor] = aux;
    }
}

double distancia(double a, double b) {
    double d = a - b;
    if (d < 0) d = -d;
    return d;
}

double maisProximo(double v[], int n, double alvo) {
    int ini = 0, fim = n - 1;
    double melhor = v[0];

    while (ini <= fim) {
        int meio = (ini + fim) / 2;

        if (distancia(v[meio], alvo) < distancia(melhor, alvo)) {
            melhor = v[meio];
        }

        if (v[meio] == alvo) {
            return v[meio];
        } else if (v[meio] < alvo) {
            ini = meio + 1;
        } else {
            fim = meio - 1;
        }
    }
    return melhor;
}

int main() {
    double precos[] = {45.0, 12.5, 99.9, 30.0, 7.0, 60.0};
    int n = 6;
    double valor;

    selectionSort(precos, n);

    printf("Valor desejado: ");
    scanf("%lf", &valor);

    printf("Preco mais proximo: %.2f\n", maisProximo(precos, n, valor));
    return 0;
}
