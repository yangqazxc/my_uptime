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
 * @param timePoints Time points array (minutes instead of days).
 * @returns The formatted site data.
 */
export const formatSiteData = (
  data: any,
  timePoints: dayjs.Dayjs[],
): MonitorsDataResult | undefined => {
  if (!data?.monitors) return undefined;
  const { public: configPublic } = useRuntimeConfig();
  const { showLink } = configPublic;
  const sites: any[] = data.monitors;
  // 解析站点数据
  const formatData = sites?.map((site: any): SiteStatusType => {
    // 解析每分钟数据
    const ranges = site.custom_uptime_ranges.split("-");
    const pings = site.custom_uptime_pings?.split("-") || []; // 解析响应时间数据
    const percent = formatNumber(ranges.pop() || 0);
    const minuteData: SiteDaysStatus[] = [];
    const timeMap = new Map();
    // 处理每分钟数据
    timePoints.forEach((timePoint, index) => {
      timeMap.set(timePoint.format("YYYYMMDDHHmm"), index);
      minuteData[index] = {
        date: timePoint.unix(),
        percent: formatNumber(ranges[index] || 0),
        down: { times: 0, duration: 0 },
        ping: pings[index] ? parseInt(pings[index]) : undefined, // 添加响应时间
      };
    });
    // 获取总数据
    const total = { times: 0, duration: 0 };
    site?.logs?.forEach((log: any) => {
      if (log?.type === 1 || log?.type === 99) {
        const timeKey = dayjs.unix(log?.datetime).format("YYYYMMDDHHmm");
        const timeIndex = timeMap.get(timeKey);
        // 修改每分钟数据
        if (timeIndex !== undefined) {
          // 更新每分钟数据
          if (minuteData[timeIndex]) {
            minuteData[timeIndex].down.times += 1;
            minuteData[timeIndex].down.duration += log.duration;
          }
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
      days: minuteData?.reverse(),
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
