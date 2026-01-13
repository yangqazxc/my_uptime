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
          class="timeline"
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
                class="minute"
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
      .minute {
        height: 26px;
        flex: 1;
        border-radius: 25px;
        background-color: var(--normal-color);
        transition: transform 0.3s;
        transform-origin: bottom;
        cursor: pointer;
        &:hover {
          transform: scale(1.1);
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

</style>
