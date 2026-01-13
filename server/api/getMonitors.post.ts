// Uptime Kuma API integration
import dayjs from "dayjs";
import type { MonitorsDataResult, MonitorsResult } from "~~/types/main";
import { getCache, setCache } from "~/utils/cache-server";
import { formatSiteData } from "~/utils/format";
import { convertKumaToUptimeRobot } from "../utils/kumaAdapter";

// 不再需要生成时间范围，直接使用心跳数量配置
const getHeartbeatCount = (): number => {
  try {
    const config = useRuntimeConfig();
    return config.public.countDays; // 现在表示要显示的心跳数量
  } catch (error) {
    console.error(error);
    return 45; // 默认45条
  }
};

/**
 * 获取站点数据（从 Uptime Kuma）
 */
export default defineEventHandler(async (event): Promise<MonitorsResult> => {
  try {
    const config = useRuntimeConfig();
    const { kumaApiUrl, kumaStatusPageSlug, sitePassword, siteSecretKey } = config;

    if (!kumaApiUrl || !kumaStatusPageSlug) {
      throw new Error("Missing Kuma API url or status page slug");
    }

    // 若登录-验证 token
    if (sitePassword && siteSecretKey) {
      const token = getCookie(event, "authToken");
      if (!token) throw new Error("Please log in first");
      // 验证 Token
      const isLogin = await verifyJwt(token);
      if (!isLogin) throw new Error("Invalid or expired token");
    }

    // 缓存键
    const cacheKey = "site-data";
    // 检查缓存
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return {
        code: 200,
        message: "success",
        source: "cache",
        data: cachedData as MonitorsDataResult,
      };
    }

    const heartbeatCount = getHeartbeatCount();

    // 调用 Kuma API 获取状态页面数据
    const statusPageUrl = `${kumaApiUrl}/api/status-page/${kumaStatusPageSlug}`;
    const heartbeatUrl = `${kumaApiUrl}/api/status-page/heartbeat/${kumaStatusPageSlug}`;

    // 并行获取两个接口的数据
    const [statusData, heartbeatData] = await Promise.all([
      $fetch(statusPageUrl, { method: "GET" }),
      $fetch(heartbeatUrl, { method: "GET" }),
    ]);

    // 转换 Kuma 数据为 UptimeRobot 格式（直接使用真实心跳）
    const convertedData = convertKumaToUptimeRobot(
      statusData,
      heartbeatData,
      heartbeatCount,
    );

    // 处理数据
    const data = formatSiteData(convertedData);

    // 缓存数据（30秒）
    setCache(cacheKey, data, 1000 * 30);

    return {
      code: 200,
      message: "success",
      source: "api",
      data,
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return {
      code: 500,
      message: error instanceof Error ? error.message : "Unknown error",
      source: "api",
      data: undefined,
    };
  }
});
