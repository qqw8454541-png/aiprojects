export const rateLimitConfig = {
  // 每分钟最大请求次数 (防高频并发)
  minuteLimit: 5,
  
  // 每天最大请求次数 (防低频慢速刷量)
  dailyLimit: 100,

  // 是否开启频率限制开关
  enabled: true
};
