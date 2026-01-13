/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from "dayjs";

/**
 * Uptime Kuma 数据适配器
 * 将 Kuma API 数据转换为 UptimeRobot 兼容格式
 */

// 状态码映射：Kuma → UptimeRobot
const STATUS_MAP: Record<number, number> = {
  1: 2, // UP → 正常
  0: 9, // DOWN → 寄了
  2: 8, // PENDING → 好像寄了
};

// 监控类型映射：Kuma → UptimeRobot
const TYPE_MAP: Record<string, number> = {
  http: 1, // HTTP(s)
  https: 1, // HTTP(s)
  keyword: 2, // Keyword
  ping: 3, // Ping
  port: 4, // Port
  heartbeat: 5, // Heartbeat
};

interface KumaHeartbeat {
  status: number;
  time: string;
  ping?: number;
  msg?: string;
  duration?: number;
}

interface KumaMonitor {
  id: number;
  name: string;
  url?: string;
  type: string;
  interval: number;
}

/**
 * 转换 Kuma 数据为 UptimeRobot 格式
 */
export function convertKumaToUptimeRobot(
  kumaStatusData: any,
  kumaHeartbeatData: any,
  minutes: dayjs.Dayjs[],
): any {
  const monitors: any[] = [];

  // 获取所有监控器
  const monitorList: KumaMonitor[] = [];
  if (kumaStatusData?.publicGroupList) {
    kumaStatusData.publicGroupList.forEach((group: any) => {
      if (group?.monitorList) {
        monitorList.push(...group.monitorList);
      }
    });
  }

  // 处理每个监控器
  monitorList.forEach((monitor: KumaMonitor) => {
    const monitorId = monitor.id;
    const heartbeats: KumaHeartbeat[] =
      kumaHeartbeatData?.heartbeatList?.[monitorId] || [];

    // 获取 URL - 尝试多个可能的字段
    let monitorUrl = (monitor as any).url || (monitor as any).hostname || monitor.name;

    // 确保 URL 有正确的协议前缀
    if (monitorUrl && !monitorUrl.startsWith('http://') && !monitorUrl.startsWith('https://')) {
      monitorUrl = 'https://' + monitorUrl;
    }

    // 计算每分钟的可用率和响应时间
    const minuteRanges: string[] = [];
    const minutePings: number[] = [];

    minutes.forEach((minute) => {
      const minuteTimestamp = minute.unix();

      // 找到距离该分钟最近的心跳（前后30秒范围内）
      let closestHeartbeat: KumaHeartbeat | null = null;
      let minTimeDiff = Infinity;

      heartbeats.forEach((h: KumaHeartbeat) => {
        const hTime = dayjs(h.time).unix();
        const timeDiff = Math.abs(hTime - minuteTimestamp);

        // 只考虑前后30秒内的心跳
        if (timeDiff <= 30 && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestHeartbeat = h;
        }
      });

      // 使用最近的心跳数据
      let percent = 0;
      let avgPing = 0;

      if (closestHeartbeat) {
        // 如果找到了心跳，使用其状态
        percent = closestHeartbeat.status === 1 ? 100 : 0;
        avgPing = closestHeartbeat.ping || 0;
      }

      minuteRanges.push(percent.toFixed(2));
      minutePings.push(Math.round(avgPing));
    });

    // 计算总可用率
    const totalPercent =
      minuteRanges.reduce((sum, p) => sum + parseFloat(p), 0) /
      minuteRanges.length;

    // 添加总可用率到最后
    minuteRanges.push(totalPercent.toFixed(2));

    // 提取故障日志
    const logs: any[] = [];
    heartbeats.forEach((h: KumaHeartbeat) => {
      if (h.status === 0) {
        // DOWN 状态
        logs.push({
          type: 1, // 故障类型
          datetime: dayjs(h.time).unix(),
          duration: h.duration || 60, // 默认60秒
        });
      }
    });

    // 获取最新状态
    const latestHeartbeat = heartbeats[0];
    const status = latestHeartbeat
      ? STATUS_MAP[latestHeartbeat.status] || 8
      : 8;

    // 构造 UptimeRobot 格式的监控器数据
    monitors.push({
      id: monitor.id,
      friendly_name: monitor.name,
      url: monitorUrl || undefined, // 使用提取的 URL
      status: status,
      type: TYPE_MAP[monitor.type?.toLowerCase()] || 1,
      interval: monitor.interval || 60,
      custom_uptime_ranges: minuteRanges.join("-"),
      custom_uptime_pings: minutePings.join("-"), // 添加响应时间数据
      logs: logs,
    });
  });

  return {
    monitors: monitors,
  };
}
