import axios from '@axios'

export function useStateAction(
  baseUrl: string,
  onSuccess: () => void,
  notify: (msg: string, color?: string) => void,
  t: (key: string) => string,
) {
  const actionDialog = ref(false)
  const actionItem = ref<any>(null)
  const actionType = ref('')
  const actioning = ref(false)

  function openAction(item: any, type: string) {
    actionItem.value = item
    actionType.value = type
    actionDialog.value = true
  }

  async function doAction(successMsg?: string, errorMsg?: string) {
    actioning.value = true
    try {
      await axios.post(`${baseUrl}${actionItem.value.id}/${actionType.value}/`)
      notify(successMsg ?? t('Updated'))
      actionDialog.value = false
      onSuccess()
    }
    catch (e: any) {
      notify(e?.response?.data?.message ?? errorMsg ?? t('Error'), 'error')
    }
    finally {
      actioning.value = false
    }
  }

  return { actionDialog, actionItem, actionType, actioning, openAction, doAction }
}
