import { Ability } from '@casl/ability'
import type { UserAbility } from './AppAbility'
import { getStoredAbilities, getStoredUserData } from '@/utils/storage'
import { isOperatorRole, sessionRole } from '@/navigation/operatorAccess'

export const initialAbility: UserAbility[] = [
  {
    action: 'read',
    subject: 'Auth',
  },
]

const existingAbility = getStoredAbilities<UserAbility[]>()
const operatorSession = isOperatorRole(sessionRole(getStoredUserData()))

// Never restore manage/all for an operator workspace, including email-selected ADMINs.
export default new Ability(operatorSession ? initialAbility : (existingAbility || initialAbility))
