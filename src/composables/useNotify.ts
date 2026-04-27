export function useNotify() {
  const snackbar = ref(false)
  const snackbarMsg = ref('')
  const snackbarColor = ref('success')

  function notify(msg: string, color = 'success') {
    snackbarMsg.value = msg
    snackbarColor.value = color
    snackbar.value = true
  }

  return { snackbar, snackbarMsg, snackbarColor, notify }
}
