<!-- 站点数据卡片 -->
<template>
  <Transition name="fade" mode="out-in">
    <div v-if="!isEmpty(siteData)" class="site-cards">
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
                }"
                :class="['minute', { 'is-new': isNewHeartbeat(site.id, minuteIndex) }]"
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

      // 600ms 后移除刷新状态
      setTimeout(() => {
        refreshingStates.value[site.id] = false;
      }, 600);

      // 2000ms 后移除新心跳高亮
      setTimeout(() => {
        newHeartbeats.value[site.id] = -1;
      }, 2000);
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

onMounted(getSiteData);
</script>

<style lang="scss" scoped>
.site-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 900px;
  margin: 30px auto 20px;
  padding: 0 20px;
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
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);

      // 刷新时的左移动画
      &.is-refreshing {
        animation: slide-left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .minute {
        height: 26px;
        flex: 1;
        border-radius: 25px;
        background-color: var(--normal-color);
        transition: transform 0.3s, box-shadow 0.3s;
        transform-origin: bottom;
        cursor: pointer;
        position: relative;

        &:hover {
          transform: scale(1.1);
        }

        // 新心跳高亮动画
        &.is-new {
          animation: pulse-glow 1.5s ease-out;
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

// 左移动画
@keyframes slide-left {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-2%);
  }
}

// 新心跳高亮动画
@keyframes pulse-glow {
  0% {
    box-shadow: 0 0 0 0 currentColor;
    transform: scale(1);
  }
  25% {
    box-shadow: 0 0 20px 5px currentColor;
    transform: scale(1.15);
  }
  50% {
    box-shadow: 0 0 15px 3px currentColor;
    transform: scale(1.1);
  }
  75% {
    box-shadow: 0 0 10px 2px currentColor;
    transform: scale(1.05);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    transform: scale(1);
  }
}

</style>
