/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from "dayjs";
import { formatNumber } from "./helper";
import type {
  MonitorsDataResult,
  SiteDaysStatus,
  SiteStatusType,
} from "~~/types/main";

/**
 * Format site data.
 * @param data The site data to format.
 * @returns The formatted site data.
 */
export const formatSiteData = (
  data: any,
): MonitorsDataResult | undefined => {
  if (!data?.monitors) return undefined;
  const { public: configPublic } = useRuntimeConfig();
  const { showLink } = configPublic;
  const sites: any[] = data.monitors;

  // 解析站点数据
  const formatData = sites?.map((site: any): SiteStatusType => {
    // 解析每个心跳的数据
    const ranges = site.custom_uptime_ranges.split("-");
    const pings = site.custom_uptime_pings?.split("-") || [];
    const times = site.custom_uptime_times?.split("-") || [];
    const percent = formatNumber(ranges.pop() || 0);

    const minuteData: SiteDaysStatus[] = [];
    const timeMap = new Map();

    // 处理每个心跳数据（使用真实时间戳）
    times.forEach((timestamp: string, index: number) => {
      const timePoint = dayjs.unix(parseInt(timestamp));
      timeMap.set(timePoint.format("YYYYMMDDHHmmss"), index);
      minuteData[index] = {
        date: parseInt(timestamp),
        percent: formatNumber(ranges[index] || 0),
        down: { times: 0, duration: 0 },
        ping: pings[index] ? parseInt(pings[index]) : undefined,
      };
    });

    // 获取总数据
    const total = { times: 0, duration: 0 };
    site?.logs?.forEach((log: any) => {
      if (log?.type === 1 || log?.type === 99) {
        // 使用精确到秒的时间匹配（因为现在使用真实心跳时间）
        const logTime = log?.datetime;
        // 找到最接近的心跳时间点
        let closestIndex = -1;
        let minDiff = Infinity;
        minuteData.forEach((data, index) => {
          const diff = Math.abs(data.date - logTime);
          if (diff < minDiff && diff <= 30) { // 30秒内的日志归属到该心跳
            minDiff = diff;
            closestIndex = index;
          }
        });

        // 修改对应心跳的数据
        if (closestIndex !== -1 && minuteData[closestIndex]) {
          minuteData[closestIndex].down.times += 1;
          minuteData[closestIndex].down.duration += log.duration;
        }

        // 更新总数据
        total.times += 1;
        total.duration += log.duration;
      }
    });
    return {
      id: site.id,
      name: site?.friendly_name || "未命名站点",
      url: showLink ? site?.url : undefined,
      status: site?.status ?? 8,
      type: site?.type ?? 1,
      interval: site?.interval ?? 0,
      percent,
      days: minuteData, // 已经在 kumaAdapter 中反转过了，不需要再次反转
      down: total,
    };
  });
  return {
    status: formatData.reduce(
      (acc, site) => {
        if (site.status === 2) acc.ok++;
        else if (site.status === 8 || site.status === 9) acc.error++;
        else if (site.status === 0 || site.status === 1) acc.unknown++;
        return acc;
      },
      { count: formatData.length, ok: 0, error: 0, unknown: 0 },
    ),
    data: formatData,
    timestamp: Date.now(),
  };
};
