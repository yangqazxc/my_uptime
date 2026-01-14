<!-- 站点数据卡片 -->
<template>
  <Transition name="fade" mode="out-in">
    <div v-if="!isEmpty(siteData)" class="site-cards" :class="{ 'is-scrolling': isScrolling }">
      <n-card
        v-for="(site, index) in siteData"
        :key="index"
        :style="{ animationDelay: `${index * 0.1}s` }"
        class="site-item"
        hoverable
      >
        <!-- 信息 -->
        <n-flex class="meta" justify="space-between">
          <n-flex :size="8" class="title" align="center">
            <n-text class="site-name">{{ site.name }}</n-text>
            <n-popover>
              <template #trigger>
                <n-tag :bordered="false" size="small" round>
                  {{ siteTypeMap[site.type]?.tag || "HTTP" }} /
                  {{ formatInterval(site?.interval) }}
                </n-tag>
              </template>
              <n-text>
                {{
                  $t("card.type.tip", {
                    interval: formatInterval(site?.interval) || "30s",
                    type: siteTypeMap[site.type]?.text,
                  })
                }}
              </n-text>
            </n-popover>
            <!-- 跳转 -->
            <n-button
              v-if="site?.url"
              :focusable="false"
              size="tiny"
              tertiary
              round
              @click="jumpLink(site.url)"
            >
              <template #icon>
                <Icon name="icon:link" />
              </template>
            </n-button>
          </n-flex>
          <n-flex
            :style="{
              '--bg-color': `var(--${siteStatusMap[site.status]?.type || 'unknown'}-color)`,
            }"
            class="status"
            align="center"
          >
            <div v-if="site.status !== 0" class="point" />
            <Icon v-else name="icon:pause" />
            <n-text>{{ siteStatusMap[site.status]?.text }}</n-text>
          </n-flex>
        </n-flex>
        <!-- 每分钟数据 -->
        <n-flex
          v-if="site?.days?.length"
          :size="2"
          :class="['timeline', { 'is-refreshing': refreshingStates[site.id] }]"
          justify="space-between"
        >
          <n-popover
            v-for="(minute, minuteIndex) in site.days"
            :key="minute?.date || minuteIndex"
          >
            <template #trigger>
              <div
                :style="{
                  backgroundColor: `var(--${getMinuteStatus(minute.percent)}-color)`,
                  '--wave-delay': `${(site.days.length - minuteIndex - 1) * 0.04}s`,
                  '--wave-intensity': `${Math.sqrt(1 - (site.days.length - minuteIndex - 1) / site.days.length)}`,
                  '--status-color': `var(--${getMinuteStatus(minute.percent)}-color)`,
                }"
                :class="[
                  'minute',
                  { 'is-new': isNewHeartbeat(site.id, minuteIndex) },
                  { 'wave-flow': refreshingStates[site.id] && !isNewHeartbeat(site.id, minuteIndex) }
                ]"
              />
            </template>
            <div class="minute-data">
              <!-- 时间标题 - 添加日期 -->
              <n-text class="time-header" strong>
                {{ minute?.date ? formatTime(minute.date, { showTime: true }) : $t("card.unknownDate") }}
              </n-text>
              <!-- 响应时间 -->
              <n-flex v-if="minute?.ping" justify="space-between" align="center" class="data-row">
                <n-text depth="3" class="label">响应时间</n-text>
                <n-text strong class="value ping">{{ minute.ping }}ms</n-text>
              </n-flex>
              <!-- 可用率 -->
              <n-flex justify="space-between" align="center" class="data-row">
                <n-text depth="3" class="label">可用率</n-text>
                <n-text strong class="value" :class="getPercentClass(minute?.percent)">
                  {{ minute?.percent }}%
                </n-text>
              </n-flex>
              <!-- 故障信息 -->
              <n-flex v-if="minute?.percent > 0 && minute?.percent < 100 && minute?.down?.times > 0" justify="space-between" align="center" class="data-row">
                <n-text depth="3" class="label">故障次数</n-text>
                <n-text class="value">{{ minute?.down?.times }} 次</n-text>
              </n-flex>
              <n-flex v-if="minute?.percent > 0 && minute?.percent < 100 && minute?.down?.duration > 0" justify="space-between" align="center" class="data-row">
                <n-text depth="3" class="label">故障时长</n-text>
                <n-text class="value">{{ formatDuration(minute?.down?.duration) }}</n-text>
              </n-flex>
              <!-- 无数据提示 -->
              <n-text v-if="minute?.percent === 0" depth="3" class="no-data">
                {{ $t("card.unknownData") }}
              </n-text>
            </div>
          </n-popover>
        </n-flex>
        <!-- 总结 -->
        <n-flex class="summary" justify="space-between">
          <n-text class="date" depth="3">
            {{ formatTime(site?.days?.[0]?.date || 0, { format: "HH:mm" }) }}
          </n-text>
          <n-text v-if="site?.down?.times" depth="3">
            {{
              $t("card.summaryData", {
                minutes: site?.days?.length,
                times: site?.down?.times,
                duration: formatDuration(site?.down?.duration),
                percent: site?.percent,
              })
            }}
          </n-text>
          <n-text v-else depth="3">
            {{
              $t("card.summary", {
                minutes: site?.days?.length,
                percent: site?.percent,
              })
            }}
          </n-text>
          <n-text class="date" depth="3">{{ $t("meta.now") }}</n-text>
        </n-flex>
      </n-card>
    </div>
    <div
      v-else
      :style="{ '--color': `var(--${statusStore.siteStatus}-color)` }"
      class="site-cards loading"
    >
      <n-card class="site-item" hoverable>
        <Transition name="fade" mode="out-in">
          <n-spin v-if="statusStore.siteStatus !== 'unknown'" />
          <n-result
            v-else
            status="error"
            :title="$t('card.error')"
            :description="$t('card.errorText')"
          >
            <template #footer>
              <n-button tertiary round @click="refresh">
                {{ $t("meta.refresh") }}
              </n-button>
            </template>
          </n-result>
        </Transition>
      </n-card>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { SiteStatusType, SiteType } from "~~/types/main";

const { t } = useI18n();
const statusStore = useStatusStore();

// 站点类型
const siteStatusMap = computed(() => ({
  0: { text: t("card.status.stop"), type: "unknown" },
  1: { text: t("card.status.unknown"), type: "unknown" },
  2: { text: t("card.status.normal"), type: "normal" },
  8: { text: t("card.status.error"), type: "error" },
  9: { text: t("card.status.down"), type: "error" },
}));

// 请求类型
const siteTypeMap = computed(() => ({
  1: { tag: "HTTP", text: t("card.type.HTTP") },
  2: { tag: "KEYWORD", text: t("card.type.KEYWORD") },
  3: { tag: "PING", text: t("card.type.PING") },
  4: { tag: "PORT", text: t("card.type.PORT") },
  5: { tag: "HEARTBEAT", text: t("card.type.HEARTBEAT") },
}));

// 全部站点数据
const siteData = computed<SiteStatusType[] | undefined>(
  () => statusStore.siteData?.data,
);

// 当前分钟站点状态
const getMinuteStatus = (percent: number): SiteType => {
  if (percent >= 100) return "normal";
  else if (percent >= 50 && percent < 100) return "warn";
  else if (percent > 0 && percent < 50) return "error";
  else return "unknown";
};

// 获取可用率颜色类名
const getPercentClass = (percent: number): string => {
  if (percent >= 100) return "success";
  else if (percent > 0) return "warning";
  else return "error";
};

// 刷新动画状态
const refreshingStates = ref<Record<number, boolean>>({});
const newHeartbeats = ref<Record<number, number>>({});
const previousData = ref<Record<number, number>>({}); // 存储每个站点最后一条心跳的时间戳

// 滚动状态 - 用于暂停动画优化性能
const isScrolling = ref(false);
let scrollTimer: NodeJS.Timeout | null = null;

// 判断是否为新心跳
const isNewHeartbeat = (siteId: number, index: number): boolean => {
  const site = siteData.value?.find(s => s.id === siteId);
  if (!site?.days?.length) return false;
  return index === site.days.length - 1 && newHeartbeats.value[siteId] === index;
};

// 监听数据变化，触发动画
watch(siteData, (newData, oldData) => {
  if (!newData) return;

  newData.forEach(site => {
    const lastHeartbeat = site.days?.[site.days.length - 1];
    if (!lastHeartbeat?.date) return;

    const previousTimestamp = previousData.value[site.id];

    // 如果有新数据（时间戳不同）
    if (previousTimestamp && lastHeartbeat.date !== previousTimestamp) {
      // 触发刷新动画
      refreshingStates.value[site.id] = true;
      newHeartbeats.value[site.id] = site.days.length - 1;

      // 计算波浪动画总时长：1.8s(呼吸) + 0.04s*颗粒数(波浪延迟) + 0.8s(单个波浪动画)
      const totalWaveTime = 1800 + (site.days.length * 40) + 800;

      // 波浪动画完成后移除刷新状态
      setTimeout(() => {
        refreshingStates.value[site.id] = false;
      }, totalWaveTime);

      // 等待所有动画完成后移除新心跳高亮
      // 1.8s(呼吸) + 0.6s*3(脉搏) + 0.2s(缓冲) = 3.8s
      setTimeout(() => {
        newHeartbeats.value[site.id] = -1;
      }, 3800);
    }

    // 更新存储的时间戳
    previousData.value[site.id] = lastHeartbeat.date;
  });
}, { deep: true });

// 重试
const refresh = async () => {
  statusStore.$patch({
    siteStatus: "loading",
    siteData: undefined,
  });
  await getSiteData();
};

onMounted(() => {
  getSiteData();

  // 监听滚动事件 - 滚动时暂停动画优化性能
  const handleScroll = () => {
    isScrolling.value = true;

    if (scrollTimer) {
      clearTimeout(scrollTimer);
    }

    scrollTimer = setTimeout(() => {
      isScrolling.value = false;
    }, 150);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // 清理
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
    if (scrollTimer) {
      clearTimeout(scrollTimer);
    }
  });
});
</script>

<style lang="scss" scoped>
.site-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 900px;
  margin: 30px auto 20px;
  padding: 0 20px;

  // 滚动时暂停所有动画并移除消耗性能的属性 - 优化手机端性能
  &.is-scrolling {
    *,
    *::before,
    *::after {
      animation-play-state: paused !important;
    }

    // 移除消耗性能的 filter 和 box-shadow
    .minute {
      filter: none !important;
      box-shadow: none !important;
    }

    .point::after {
      animation-play-state: paused !important;
    }
  }

  .site-item {
    opacity: 0;
    border-radius: 12px;
    animation: float-up 0.5s forwards;
    overflow: hidden;
    .meta {
      .site-name {
        font-weight: bold;
      }
      .n-tag {
        --n-height: 20px;
        cursor: pointer;
      }
      .status {
        .n-text {
          color: var(--bg-color);
        }
        svg {
          font-size: 22px;
          margin-right: -4px;
          color: var(--bg-color);
        }
      }
      .point {
        position: relative;
        width: 14px;
        height: 14px;
        min-width: 14px;
        background-color: var(--bg-color);
        border-radius: 50%;
        &::after {
          content: "";
          background-color: var(--bg-color);
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          border-radius: 50%;
          opacity: 1;
          z-index: -1;
          animation: breathing 1.5s ease infinite;
          transition: background-color 1s;
        }
      }
    }
    .timeline {
      margin: 15px 0 10px;
      position: relative;
      will-change: transform;

      // 移除整体刷新动画，改用单个颗粒波浪
      &.is-refreshing {
        // 不再需要整体动画
      }

      .minute {
        height: 26px;
        flex: 1;
        border-radius: 25px;
        background-color: var(--normal-color);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: center;
        cursor: pointer;
        position: relative;
        will-change: transform, filter, box-shadow;

        &:hover {
          transform: scaleY(1.12) scaleX(1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        // 新心跳垂直呼吸动画 - 精致的上下形变
        &.is-new {
          animation: breathe-vertical 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards,
                     breathe-pulse 0.6s ease-in-out 2s 3;
        }

        // 波浪流动效果 - 从新颗粒左侧第一个开始
        &.wave-flow {
          animation: wave-flow-left 0.8s cubic-bezier(0.4, 0, 0.2, 1) both;
          animation-delay: calc(1.8s + var(--wave-delay));
        }
      }
    }
    .summary {
      .date {
        width: 100px;
        &:last-child {
          text-align: right;
        }
      }
      .n-text {
        font-size: 13px;
      }
    }
  }
  &.loading {
    .site-item {
      min-height: 200px;
      :deep(.n-card__content) {
        padding: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
    .n-spin-body {
      --n-size: 40px;
      --n-color: var(--color);
    }
  }
}
.minute-data {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
  padding: 2px 0;
  .time-header {
    font-size: 13px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--n-divider-color);
    margin-bottom: 2px;
    text-align: center;
  }
  .data-row {
    padding: 2px 0;
    font-size: 12px;
    .label {
      font-size: 12px;
    }
    .value {
      font-size: 12px;
      &.ping {
        color: #18a058;
      }
      &.success {
        color: #18a058;
      }
      &.warning {
        color: #f0a020;
      }
      &.error {
        color: #d03050;
      }
    }
  }
  .no-data {
    text-align: center;
    padding: 4px 0;
    font-size: 12px;
  }
}

// 整体左移流动动画 - 已废弃，改用单个颗粒波浪流动
@keyframes slide-left-flow {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-2%);
  }
}

// 单个颗粒波浪流动动画 - 低调优雅 + 强度渐变
@keyframes wave-flow-left {
  0% {
    transform: translateX(0) scaleY(1);
    filter: brightness(1);
    box-shadow: 0 0 0 rgba(24, 160, 88, 0);
  }
  50% {
    transform: translateX(calc(-6px * var(--wave-intensity))) scaleY(calc(1 + 0.04 * var(--wave-intensity)));
    filter: brightness(calc(1 + 0.12 * var(--wave-intensity)));
    box-shadow: 0 0 calc(10px * var(--wave-intensity)) rgba(24, 160, 88, calc(0.4 * var(--wave-intensity)));
  }
  100% {
    transform: translateX(0) scaleY(1);
    filter: brightness(1);
    box-shadow: 0 0 0 rgba(24, 160, 88, 0);
  }
}

// 新心跳垂直呼吸动画 - 精致的上下形变 + 传递效果
@keyframes breathe-vertical {
  0% {
    opacity: 0;
    transform: scaleY(0.75) scaleX(1);
    filter: brightness(1) blur(0.5px);
    box-shadow: 0 0 0 rgba(24, 160, 88, 0);
  }
  25% {
    opacity: 1;
    transform: scaleY(1.15) scaleX(1);
    filter: brightness(1.45) blur(0);
    box-shadow: 0 0 12px rgba(24, 160, 88, 0.6);
  }
  50% {
    transform: scaleY(0.92) scaleX(1);
    filter: brightness(1.25) blur(0);
    box-shadow: 0 0 8px rgba(24, 160, 88, 0.4);
  }
  75% {
    transform: scaleY(1.05) scaleX(1);
    filter: brightness(1.12) blur(0);
    box-shadow: 0 0 4px rgba(24, 160, 88, 0.2);
  }
  90% {
    transform: scaleY(1.02) scaleX(1) translateX(-2px);
    filter: brightness(1.08);
    box-shadow: -2px 0 6px rgba(24, 160, 88, 0.3);
  }
  100% {
    opacity: 1;
    transform: scaleY(1) scaleX(1) translateX(0);
    filter: brightness(1.05);
    box-shadow: 0 0 3px rgba(24, 160, 88, 0.15);
  }
}

// 新颗粒余韵脉搏 - 呼吸完成后的微弱脉动
@keyframes breathe-pulse {
  0%, 100% {
    filter: brightness(1.05);
    box-shadow: 0 0 3px rgba(24, 160, 88, 0.15);
  }
  50% {
    filter: brightness(1.1);
    box-shadow: 0 0 6px rgba(24, 160, 88, 0.25);
  }
}

</style>
