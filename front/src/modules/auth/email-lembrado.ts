// "Lembrar meu e-mail" (TASK-072): só o e-mail, nunca a senha nem o token.
// Navegador sem localStorage (modo privado bloqueado) segue sem lembrar.
const CHAVE = 'vigia.email-lembrado'

export function lerEmailLembrado(): string {
  try {
    return localStorage.getItem(CHAVE) ?? ''
  } catch {
    return ''
  }
}

export function lembrarEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(CHAVE, email)
    else localStorage.removeItem(CHAVE)
  } catch {
    // sem armazenamento: não lembra
  }
}
