<template>
  <GlobalProvider>
    <n-scrollbar
      :content-style="{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }"
      style="height: 100vh"
      @scroll="siteScroll"
    >
      <SiteNav />
      <Transition name="fade">
        <SiteHeader v-if="statusStore.loginStatus" />
      </Transition>
      <!-- 主内容 -->
      <main v-if="siteLoaded" id="main">
        <Transition name="fade" mode="out-in">
          <!-- 密码验证 -->
          <SiteLogin v-if="!statusStore.loginStatus" />
          <!-- 站点卡片 -->
          <SiteCards v-else />
        </Transition>
      </main>
      <SiteFooter />
      <!-- 回到顶部 -->
      <n-back-top :visibility-height="10" />
    </n-scrollbar>
  </GlobalProvider>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const statusStore = useStatusStore();

const { setLocale } = useI18n();

// 加载状态
const siteLoaded = ref<boolean>(false);

// 验证状态
const checkSite = async () => {
  try {
    const result = await $fetch("/api/check", { method: "POST" });
    // 更改登录状态
    statusStore.loginStatus = result.code === 200;
  } catch (error) {
    console.error("error in checkSite", error);
  } finally {
    siteLoaded.value = true;
  }
};

// 页面滚动（节流 + rAF 同步浏览器绘制帧，避免帧不同步导致卡顿）
let rafId = 0;
const siteScrollRaw = (e: Event) => {
  const scrollTop = (e.target as HTMLElement).scrollTop;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    statusStore.scrollTop = scrollTop;
  });
};
const siteScroll = useThrottleFn(siteScrollRaw, 50);

// 更改站点语言
const setSiteLang = (lang: string) => {
  setLocale(lang);
  useHead({ htmlAttrs: { lang } });
};

// 监听站点状态
watch(
  () => statusStore.siteStatus,
  (status) => {
    const { siteTitle } = config.public;
    // 错误数据
    const isError = status === "error" || status === "warn";
    const error = statusStore.siteData?.status?.error || 0;
    const unknown = statusStore.siteData?.status?.unknown || 0;
    // 更改信息
    useHead({
      // 更改标题
      title: isError ? `( ${error + unknown} ) ` + siteTitle : siteTitle,
    });
    // 更改图标
    useFavicon(isError ? "/favicon-error.ico" : "/favicon.ico");
  },
);

// 语言更改
watch(() => statusStore.siteLang, setSiteLang);

onBeforeMount(checkSite);

onMounted(() => {
  setSiteLang(statusStore.siteLang);

  // 为 n-scrollbar 内核容器添加 passive 滚动监听，提升移动端性能
  nextTick(() => {
    const scrollContainer = document.querySelector('.n-scrollbar-container');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', siteScroll as EventListener, { passive: true });
    }
  });
});
</script>

<style lang="scss" scoped>
main {
  width: 100%;
  height: 100%;
  flex: 1;
}
</style>
