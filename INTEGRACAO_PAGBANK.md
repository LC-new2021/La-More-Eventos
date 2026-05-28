# Guia Técnico de Integração — Maquininhas Smart POS PagBank

Este documento orienta sobre o processo técnico para integrar o sistema **La More Eventos** (Next.js) diretamente com as maquininhas de cartão inteligentes do PagBank (Moderninha Smart / Smart POS rodando Android).

---

## 1. Como Funciona a Integração
As maquininhas Smart do PagBank rodam uma versão customizada do Android. Como nosso sistema é uma aplicação web (Next.js), a forma ideal e homologada de integração consiste em usar um **Aplicativo Wrapper Android (WebView)** que encapsula o site do evento e faz a ponte com o hardware da máquina (leitor de cartão e impressora térmica).

```
+-----------------------------------------------------------+
|                   Smart POS (Android)                      |
|                                                           |
|  +-----------------------------------------------------+  |
|  |           WebView App (Wrapper Android)             |  |
|  |                                                     |  |
|  |   Next.js (La More Eventos Web App)                 |  |
|  |   - Dispara: window.AndroidBridge.cobrar(...)       |  |
|  |                                                     |  |
|  +-----|-----------------------------------------------+  |
|        | (Javascript Bridge)                              |
|        v                                                  |
|  +-----------------------------------------------------+  |
|  |   Código Nativo Java/Kotlin                         |  |
|  |   - Consome a biblioteca PlugPag SDK                |  |
|  |   - Executa transação de chip/NFC/Tarja             |  |
|  +-----|-----------------------------------------------+  |
|        |                                                  |
|        v                                                  |
|  +-----------------------------------------------------+  |
|  |   PlugPag Service (App do PagBank rodando na POS)   |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

---

## 2. Passo a Passo da Implementação do App Wrapper (Android)

### Passo A: Configuração do Projeto Android no Android Studio
1. Crie um novo projeto Android em Kotlin ou Java.
2. Adicione a dependência do **PlugPag SDK** no arquivo `build.gradle`:
   ```groovy
   implementation 'com.pagseguro.uol:plugpag-bootstrap:1.24.0' // Versão de exemplo
   ```

### Passo B: Criação do JavaScript Bridge no WebView
No código Java/Kotlin do aplicativo, declare a interface que o Next.js chamará via navegador:

```kotlin
class WebAppInterface(private val context: Context, private val webView: WebView) {

    // Instância do PlugPag
    private val plugPag = PlugPag(context)

    @JavascriptInterface
    fun efetuarPagamento(valorCentavos: Int, tipo: String) {
        // tipo: "CREDITO", "DEBITO", "PIX"
        val paymentType = if (tipo == "DEBITO") PlugPag.TYPE_DEBITO else PlugPag.TYPE_CREDITO
        
        val paymentData = PlugPagPaymentData(
            paymentType,
            valorCentavos,
            PlugPag.INSTALLMENT_TYPE_A_VISTA,
            1, // parcelas
            "REF_VENDA_" + System.currentTimeMillis()
        )

        // Iniciar transação via PlugPag
        val result = plugPag.doPayment(paymentData)
        
        // Retornar resultado para a WebApp
        webView.post {
            if (result.result == PlugPag.RET_OK) {
                webView.loadUrl("javascript:window.onPaymentSuccess('${result.transactionCode}')")
            } else {
                webView.loadUrl("javascript:window.onPaymentError('${result.message}')")
            }
        }
    }

    @JavascriptInterface
    fun imprimirRecibo(texto: String) {
        // Disparar comando de impressão da impressora térmica interna
        val printer = PlugPagPrinter(plugPag)
        printer.printCustomString(texto)
    }
}
```

Vincule o Bridge ao WebView que carrega o sistema La More Eventos:
```kotlin
webView.settings.javaScriptEnabled = true
webView.addJavascriptInterface(WebAppInterface(this, webView), "AndroidBridge")
webView.loadUrl("https://painel.lamoreautomacao.com.br/pos")
```

---

## 3. Integração no Código Web (Next.js)
No sistema Next.js, criamos funções utilitárias para identificar se o sistema está rodando dentro de uma maquininha Smart POS e disparar as chamadas nativas:

```javascript
// Verificar se está rodando no app da maquininha
export function isSmartPOS() {
  return typeof window !== "undefined" && window.AndroidBridge !== undefined;
}

// Disparar pagamento de cartão físico na maquininha
export function pagarNaMaquininha(valorTotal, tipoMetodo) {
  return new Promise((resolve, reject) => {
    if (!isSmartPOS()) {
      reject("Dispositivo não é uma maquininha Smart POS homologada.");
      return;
    }

    const valorCentavos = Math.round(parseFloat(valorTotal) * 100);

    // Callbacks globais que o App Android chamará ao concluir
    window.onPaymentSuccess = (transactionCode) => {
      resolve({ success: true, transactionCode });
    };
    window.onPaymentError = (errorMessage) => {
      reject(errorMessage);
    };

    // Chamar ponte Android
    window.AndroidBridge.efetuarPagamento(valorCentavos, tipoMetodo);
  });
}

// Disparar impressão física do recibo de recarga/consumo
export function imprimirViaMaquininha(textoDoRecibo) {
  if (isSmartPOS()) {
    window.AndroidBridge.imprimirRecibo(textoDoRecibo);
  } else {
    // Fallback para impressão de navegador comum/térmica USB
    window.print();
  }
}
```

---

## 4. Homologação e Publicação do App no PagBank
Para publicar o aplicativo WebView na loja oficial das maquininhas (AppMarket do PagBank):
1. **Credenciamento**: Cadastre sua conta PJ no portal de desenvolvedores do PagBank.
2. **Homologação Sandbox**: Utilize aparelhos de teste (físicos ou emulador) com cartões de teste de débito/crédito.
3. **Submissão**: Envie o arquivo `.apk` gerado pelo Android Studio para validação técnica da equipe de qualidade do PagBank. Uma vez aprovado, o aplicativo ficará disponível para instalação nas suas maquininhas associadas ao seu CNPJ.
