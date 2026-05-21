import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/** 轻触 - 数字键盘按键、座位选择 */
export const hapticLight = () => {
  try { Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); } catch {}
};

/** 中等 - 页面导航、确认操作 */
export const hapticMedium = () => {
  try { Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); } catch {}
};

/** 重击 - 侧滑返回触发、删除确认 */
export const hapticHeavy = () => {
  try { Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); } catch {}
};

/** 成功通知 - 计算完成、保存成功 */
export const hapticSuccess = () => {
  try { Haptics.notification({ type: NotificationType.Success }).catch(() => {}); } catch {}
};

/** 警告通知 - 分数不匹配、操作失败 */
export const hapticWarning = () => {
  try { Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); } catch {}
};
