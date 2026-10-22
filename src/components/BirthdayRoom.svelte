<script lang="ts">
	import { onMount } from "svelte";
	import { BIRTHDAY_LABEL, getBirthdayState, type BirthdayState } from "../utils/birthday";
	import { url } from "../utils/url-utils";

	export let name = "Yaron";

	interface ConfettiPiece {
		x: number;
		y: number;
		vx: number;
		vy: number;
		rot: number;
		vr: number;
		width: number;
		height: number;
		color: string;
		life: number;
		shape: number;
	}

	const wishes = [
		{ icon: "🎂", title: "平安喜乐", text: "生日快乐，愿你日日有小欢喜，岁岁皆胜意。" },
		{ icon: "🌸", title: "所遇皆温柔", text: "愿新的一岁，有人懂你的可爱，也有人珍惜你的真诚。" },
		{ icon: "✨", title: "心愿渐成", text: "愿你热爱不减，心愿渐成，走的每一步都更靠近自己。" },
	];

	const fortunes = [
		{ tier: "上上签", text: "许下的愿望，正在以它的速度靠近你。", yi: "吃甜", ji: "熬夜", en: "A wish in progress." },
		{ tier: "上签", text: "被偏爱这件事，你值得慢慢习惯。", yi: "拥抱", ji: "自我怀疑", en: "You are allowed to be loved." },
		{ tier: "中签", text: "慢一点也没关系，答案会在路上出现。", yi: "散步", ji: "催促自己", en: "Slow is also a way." },
		{ tier: "上上签", text: "今年吹来的风，都带着一点甜。", yi: "蛋糕", ji: "空着肚子", en: "The air tastes like cake." },
		{ tier: "上签", text: "别急着长大，先把今天过好。", yi: "发呆", ji: "赶路", en: "Stay a little longer." },
		{ tier: "中签", text: "去爱具体的人，做具体的事。", yi: "发消息", ji: "独自逞强", en: "Love something concrete." },
		{ tier: "上签", text: "这一岁，宜勇敢，也宜心动。", yi: "表白", ji: "退后", en: "Be brave, be moved." },
		{ tier: "上上签", text: "你正在成为更好的人，只是自己还没发现。", yi: "照镜子", ji: "比较", en: "You are already becoming." },
	];

	const candleSpots = [
		{ x: 165, top: 124, color: "#e8a1b3" },
		{ x: 210, top: 110, color: "#bccdb4" },
		{ x: 255, top: 124, color: "#e8a1b3" },
	];

	const petals = Array.from({ length: 12 }, (_, index) => {
		const left = (index * 37 + 9) % 96;
		const drift = -34 + ((index * 53) % 92);
		const size = 6 + (index % 4) * 2.5;
		const duration = 17 + (index % 5) * 3.5;
		const delay = -(index * 1.9);
		return `left:${left}%;--drift:${drift}px;--size:${size}px;--fall-duration:${duration}s;--fall-delay:${delay}s;`;
	});

	const pad = (value: number) => String(value).padStart(2, "0");

	let calendar: BirthdayState | null = null;
	let dateUnavailable = false;
	let candles = [true, true, true];
	let candlesOut = false;
	let selected = 0;
	let sent = false;
	let celebrating = false;
	let animationId = 0;
	let animationTimer: number | undefined;
	let room: HTMLDivElement;
	let roomHeight = 1400;
	let pageVisible = true;
	let fortuneIndex = 0;
	let fortuneFlipped = false;
	let fortuneBusy = false;
	let fortuneDraws = 0;
	let fortuneTimer: number | undefined;
	let letterOpen = false;
	let musicPlaying = false;
	let musicAvailable = true;
	let musicHint = false;
	let audioCtx: AudioContext | null = null;
	let musicGain: GainNode | null = null;
	let musicNodes: OscillatorNode[] = [];
	let musicTimer: number | undefined;
	let confettiCanvas: HTMLCanvasElement;
	let confettiCtx: CanvasRenderingContext2D | null = null;
	let confettiPieces: ConfettiPiece[] = [];
	let confettiRaf = 0;
	let confettiDpr = 1;
	let cakeStage: HTMLDivElement;
	let sendAnchor: HTMLDivElement;
	let reducedMotion = false;

	$: candlesOut = candles.every((lit) => !lit);

	function sparkle() {
		clearTimeout(animationTimer);
		animationId += 1;
		celebrating = true;
		animationTimer = window.setTimeout(() => {
			celebrating = false;
		}, 1500);
	}

	function toggleCandle(index: number) {
		const next = candles.map((lit, i) => (i === index ? !lit : lit));
		candles = next;
		if (next[index]) return;
		chime();
		if (next.every((lit) => !lit)) {
			sparkle();
			burstConfetti(originOf(cakeStage), 90);
		}
	}

	function onCandleKey(event: KeyboardEvent, index: number) {
		if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
			event.preventDefault();
			toggleCandle(index);
		}
	}

	function blowCandles() {
		if (candlesOut) {
			candles = [true, true, true];
			return;
		}
		candles = [false, false, false];
		chime();
		sparkle();
		burstConfetti(originOf(cakeStage), 100);
	}

	function sendWish() {
		sent = true;
		sparkle();
		burstConfetti(originOf(sendAnchor), 36);
	}

	function drawFortune() {
		if (fortuneBusy) return;
		fortuneBusy = true;
		clearTimeout(fortuneTimer);
		if (fortuneFlipped) {
			fortuneFlipped = false;
			fortuneTimer = window.setTimeout(() => {
				fortuneIndex = nextFortuneIndex();
				fortuneDraws += 1;
				fortuneFlipped = true;
				fortuneBusy = false;
			}, 520);
		} else {
			fortuneIndex = nextFortuneIndex();
			fortuneDraws += 1;
			fortuneFlipped = true;
			fortuneTimer = window.setTimeout(() => {
				fortuneBusy = false;
			}, 620);
		}
	}

	function nextFortuneIndex() {
		if (fortunes.length < 2) return 0;
		let next = fortuneIndex;
		while (next === fortuneIndex) next = Math.floor(Math.random() * fortunes.length);
		return next;
	}

	function toggleLetter() {
		letterOpen = !letterOpen;
	}

	function originOf(element: HTMLElement | undefined) {
		if (!element) return undefined;
		const rect = element.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.35 };
	}

	/* Confetti ---------------------------------------------------------------- */

	function setupConfetti() {
		if (!confettiCanvas) return;
		confettiDpr = Math.min(window.devicePixelRatio || 1, 2);
		confettiCanvas.width = Math.floor(window.innerWidth * confettiDpr);
		confettiCanvas.height = Math.floor(window.innerHeight * confettiDpr);
		confettiCtx = confettiCanvas.getContext("2d");
		if (confettiCtx) confettiCtx.setTransform(confettiDpr, 0, 0, confettiDpr, 0, 0);
	}

	function burstConfetti(origin: { x: number; y: number } | undefined, count: number) {
		if (reducedMotion || !confettiCtx) return;
		const start = origin ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };
		const palette = ["#d97991", "#e8a1b3", "#f3c1c9", "#e8b96a", "#b9c9a8", "#86aecb", "#fff3e3"];
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 4 + Math.random() * 9;
			confettiPieces.push({
				x: start.x,
				y: start.y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 3,
				rot: Math.random() * Math.PI,
				vr: (Math.random() - 0.5) * 0.35,
				width: 5 + Math.random() * 7,
				height: 3 + Math.random() * 5,
				color: palette[Math.floor(Math.random() * palette.length)],
				life: 120 + Math.random() * 60,
				shape: Math.floor(Math.random() * 3),
			});
		}
		if (!confettiRaf) confettiRaf = requestAnimationFrame(confettiFrame);
	}

	function confettiFrame() {
		const ctx = confettiCtx;
		if (!ctx) {
			confettiRaf = 0;
			return;
		}
		const width = window.innerWidth;
		const height = window.innerHeight;
		ctx.clearRect(0, 0, width, height);
		confettiPieces = confettiPieces.filter((piece) => piece.life > 0 && piece.y < height + 60);
		for (const piece of confettiPieces) {
			piece.vy += 0.16;
			piece.vx *= 0.995;
			piece.vy *= 0.995;
			piece.x += piece.vx;
			piece.y += piece.vy;
			piece.rot += piece.vr;
			piece.life -= 1;
			ctx.save();
			ctx.globalAlpha = Math.min(1, piece.life / 45);
			ctx.translate(piece.x, piece.y);
			ctx.rotate(piece.rot);
			ctx.fillStyle = piece.color;
			if (piece.shape === 0) {
				ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
			} else if (piece.shape === 1) {
				ctx.beginPath();
				ctx.arc(0, 0, piece.width / 2, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.beginPath();
				ctx.ellipse(0, 0, piece.width / 2, piece.height / 2, 0, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}
		if (confettiPieces.length > 0) {
			confettiRaf = requestAnimationFrame(confettiFrame);
		} else {
			confettiRaf = 0;
			ctx.clearRect(0, 0, width, height);
		}
	}

	/* Music box --------------------------------------------------------------- */

	function ensureAudio(): AudioContext | null {
		if (!musicAvailable) return null;
		if (!audioCtx) {
			const Ctor =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Ctor) {
				musicAvailable = false;
				return null;
			}
			try {
				audioCtx = new Ctor();
			} catch {
				musicAvailable = false;
				return null;
			}
		}
		if (audioCtx.state === "suspended") void audioCtx.resume();
		return audioCtx;
	}

	function playTone(freq: number, when: number, duration: number, volume: number) {
		const ctx = audioCtx;
		const master = musicGain;
		if (!ctx || !master) return;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(0.0001, when);
		gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), when + 0.012);
		gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
		osc.connect(gain);
		gain.connect(master);
		osc.start(when);
		osc.stop(when + duration + 0.05);
		musicNodes.push(osc);

		const shimmer = ctx.createOscillator();
		const shimmerGain = ctx.createGain();
		shimmer.type = "triangle";
		shimmer.frequency.value = freq * 2.01;
		shimmerGain.gain.setValueAtTime(0.0001, when);
		shimmerGain.gain.exponentialRampToValueAtTime(Math.max(volume * 0.26, 0.0002), when + 0.01);
		shimmerGain.gain.exponentialRampToValueAtTime(0.0001, when + duration * 0.55);
		shimmer.connect(shimmerGain);
		shimmerGain.connect(master);
		shimmer.start(when);
		shimmer.stop(when + duration * 0.55 + 0.05);
		musicNodes.push(shimmer);
	}

	function playMusic() {
		const ctx = ensureAudio();
		if (!ctx) return;
		stopMusic(false);
		musicGain = ctx.createGain();
		musicGain.gain.value = 0.34;
		musicGain.connect(ctx.destination);

		const beat = 0.36;
		const melody: Array<[number, number]> = [
			[392.0, 1], [392.0, 1], [440.0, 1], [392.0, 1], [523.25, 1], [493.88, 2],
			[392.0, 1], [392.0, 1], [440.0, 1], [392.0, 1], [587.33, 1], [523.25, 2],
			[392.0, 1], [392.0, 1], [783.99, 1], [659.25, 1], [523.25, 1], [493.88, 1], [440.0, 2],
			[698.46, 1], [698.46, 1], [659.25, 1], [523.25, 1], [587.33, 1], [523.25, 2],
		];
		let time = ctx.currentTime + 0.12;
		let total = 0;
		for (const [freq, length] of melody) {
			playTone(freq, time, 0.85, 0.052);
			if (length > 1) playTone(freq / 2, time, 1.3, 0.026);
			time += length * beat;
			total += length * beat;
		}
		musicPlaying = true;
		clearTimeout(musicTimer);
		musicTimer = window.setTimeout(() => {
			musicPlaying = false;
		}, (total + 1.4) * 1000);
	}

	function stopMusic(updateState = true) {
		clearTimeout(musicTimer);
		const ctx = audioCtx;
		if (ctx && musicGain) {
			const now = ctx.currentTime;
			musicGain.gain.cancelScheduledValues(now);
			musicGain.gain.setValueAtTime(musicGain.gain.value, now);
			musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.18);
		}
		const nodes = musicNodes;
		musicNodes = [];
		if (ctx) {
			const stopAt = ctx.currentTime + 0.24;
			for (const node of nodes) {
				try {
					node.stop(stopAt);
				} catch {
					// The node may already have ended; nothing to clean up.
				}
			}
		}
		const gain = musicGain;
		musicGain = null;
		if (gain) {
			window.setTimeout(() => {
				try {
					gain.disconnect();
				} catch {
					// Already disconnected.
				}
			}, 420);
		}
		if (updateState) musicPlaying = false;
	}

	function toggleMusic() {
		if (musicPlaying) {
			stopMusic();
			return;
		}
		playMusic();
		musicHint = true;
	}

	function chime() {
		const ctx = ensureAudio();
		if (!ctx) return;
		const master = ctx.createGain();
		master.gain.value = 0.3;
		master.connect(ctx.destination);
		const notes = [523.25, 659.25, 783.99, 1046.5];
		notes.forEach((freq, index) => {
			const when = ctx.currentTime + 0.02 + index * 0.085;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, when);
			gain.gain.exponentialRampToValueAtTime(0.14, when + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
			osc.connect(gain);
			gain.connect(master);
			osc.start(when);
			osc.stop(when + 1.2);
		});
		window.setTimeout(() => {
			try {
				master.disconnect();
			} catch {
				// Already disconnected.
			}
		}, 2400);
	}

	/* Scroll reveal ----------------------------------------------------------- */

	function reveal(node: HTMLElement, delay = 0) {
		node.style.setProperty("--reveal-delay", `${delay}ms`);
		if (typeof IntersectionObserver === "undefined") {
			node.classList.add("in-view");
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					node.classList.add("in-view");
					observer.disconnect();
					break;
				}
			},
			{ rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			},
		};
	}

	/* Lifecycle --------------------------------------------------------------- */

	onMount(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		reducedMotion = query.matches;
		const onMotionChange = () => {
			reducedMotion = query.matches;
		};
		query.addEventListener("change", onMotionChange);

		if (!window.AudioContext && !(window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) {
			musicAvailable = false;
		}

		const resizeObserver = new ResizeObserver(() => {
			roomHeight = room.offsetHeight;
		});
		roomHeight = room.offsetHeight;
		resizeObserver.observe(room);

		const update = () => {
			pageVisible = !document.hidden;
			if (!pageVisible && musicPlaying) stopMusic();
			try {
				calendar = getBirthdayState();
				dateUnavailable = false;
			} catch {
				dateUnavailable = true;
			}
		};
		update();
		const calendarTimer = window.setInterval(update, 1000);
		window.addEventListener("pageshow", update);
		document.addEventListener("visibilitychange", update);

		setupConfetti();
		window.addEventListener("resize", setupConfetti);

		return () => {
			resizeObserver.disconnect();
			clearInterval(calendarTimer);
			clearTimeout(animationTimer);
			clearTimeout(fortuneTimer);
			clearTimeout(musicTimer);
			if (confettiRaf) cancelAnimationFrame(confettiRaf);
			window.removeEventListener("pageshow", update);
			window.removeEventListener("resize", setupConfetti);
			document.removeEventListener("visibilitychange", update);
			query.removeEventListener("change", onMotionChange);
			stopMusic(false);
			if (audioCtx) void audioCtx.close();
		};
	});
</script>

<div
	class="birthday-room"
	bind:this={room}
	style={`--room-h: ${roomHeight}px`}
	data-pagefind-ignore
>
	<div class="room-atmosphere" aria-hidden="true">
		{#each petals as petal}
			<span class="petal" style={petal}></span>
		{/each}
		<span class="glow glow-one"></span>
		<span class="glow glow-two"></span>
	</div>
	<span class="room-frame" aria-hidden="true"></span>
	<canvas class="confetti-canvas" bind:this={confettiCanvas} aria-hidden="true"></canvas>

	<div class="room-topline">
		<a class="back-link" href={url("/")}><span aria-hidden="true">←</span> 回到日常</a>
		<span class="topline-center">一间留给好日子的小屋 <span aria-hidden="true">♡</span></span>
		<span class="topline-right">{BIRTHDAY_LABEL}</span>
	</div>

	<section class="birthday-hero" aria-labelledby="birthday-title">
		<div class="hero-copy">
			<p class="eyebrow intro" style="--intro-delay: 60ms">
				<span class="eyebrow-line" aria-hidden="true"></span>
				<span class="eyebrow-star" aria-hidden="true">✧</span>
				<span class="eyebrow-text">A LITTLE BIRTHDAY RITUAL</span>
				<span class="eyebrow-no">NO. 09 · 13</span>
			</p>
			<div class="date-tag intro" style="--intro-delay: 120ms">
				<span class="date-dot" aria-hidden="true"></span>{BIRTHDAY_LABEL}<span
					class="tag-separator"
					aria-hidden="true">/</span
				>一年一度，如约而至
			</div>
			<h1 id="birthday-title" class="intro" style="--intro-delay: 180ms">
				Happy Birthday,<br />
				<span class="birthday-name"
					>{name}.<svg class="name-underline" viewBox="0 0 260 16" aria-hidden="true" preserveAspectRatio="none"
						><path d="M4 11 C58 3, 168 2, 256 8" vector-effect="non-scaling-stroke"></path></svg
					></span
				><span class="title-star" aria-hidden="true">✳</span>
			</h1>
			<p class="hero-description intro" style="--intro-delay: 240ms">
				给平凡的日子，加一点甜。<br />
				愿新的一岁，依然有热爱，也有被好好爱着的日常。
			</p>
			<p class="hero-today-tip intro" style="--intro-delay: 280ms">
				今日宜 · 吃甜 <span aria-hidden="true">/</span> 许愿 <span aria-hidden="true">/</span> 被好好爱着
			</p>
			<div class="meta-pills intro" style="--intro-delay: 320ms">
				<span class="meta-pill">{BIRTHDAY_LABEL}</span>
				<span class="meta-pill">{calendar ? `公历 ${calendar.birthdayDay.replaceAll("-", ".")}` : "公历 · 待翻开"}</span>
				<span class="meta-pill">北京时间 UTC+8</span>
			</div>

			{#if calendar?.isBirthday}
				<div class="today-card intro" style="--intro-delay: 380ms">
					<span class="today-icon" aria-hidden="true">🎈</span>
					<div class="today-copy">
						<strong>就是今天，生日快乐！</strong>
						<p>谢谢你来，让今天又多了一点温暖。</p>
					</div>
					<button class="firework-button" type="button" onclick={() => burstConfetti(undefined, 120)}>
						放一串小烟花 <span aria-hidden="true">✧</span>
					</button>
				</div>
			{:else if calendar}
				<div class="countdown-card intro" style="--intro-delay: 380ms">
					<div class="countdown-head">
						<span>距离下一次生日</span>
						<span class="countdown-zone">UTC+8</span>
					</div>
					<div
						class="countdown"
						role="timer"
						aria-label={`距离生日还有 ${calendar.days} 天 ${calendar.hours} 小时 ${calendar.minutes} 分钟 ${calendar.seconds} 秒`}
					>
						<span class="cd-unit"><b>{pad(calendar.days)}</b><small>天</small></span>
						<span class="cd-unit"><b>{pad(calendar.hours)}</b><small>时</small></span>
						<span class="cd-unit"><b>{pad(calendar.minutes)}</b><small>分</small></span>
						<span class="cd-unit"
							>{#key calendar.seconds}<b class="cd-sec">{pad(calendar.seconds)}</b>{/key}<small>秒</small></span
						>
					</div>
					<div class="countdown-foot">
						<span class="foot-dot" aria-hidden="true"></span>下一次相聚 · {calendar.birthdayDay.replaceAll(
							"-",
							".",
						)}
					</div>
				</div>
			{:else}
				<p class="calendar-placeholder intro" style="--intro-delay: 380ms">
					{dateUnavailable ? "每年农历九月十三，都在这里相聚。" : "正在翻开生日的日历……"}
				</p>
			{/if}
		</div>

		<div class="cake-side">
			<div class="cake-orbit intro" style="--intro-delay: 200ms" bind:this={cakeStage}>
				<svg class="orbit-text" viewBox="0 0 400 400" aria-hidden="true">
					<defs>
						<path id="birthday-orbit-path" d="M200,200 m-162,0 a162,162 0 1,1 324,0 a162,162 0 1,1 -324,0"></path>
					</defs>
					<text>
						<textPath href="#birthday-orbit-path" startOffset="0"
							>HAPPY BIRTHDAY · 农历九月十三 · HAPPY BIRTHDAY · 农历九月十三 ·</textPath
						>
					</text>
				</svg>
				<span class="orbit-spark spark-one" aria-hidden="true">✦</span>
				<span class="orbit-spark spark-two" aria-hidden="true">✧</span>
				<span class="orbit-spark spark-three" aria-hidden="true">♡</span>
				<span class="cake-halo" aria-hidden="true"></span>

				<div class="cake-stage">
					<span class="cake-note">make a little wish</span>
					<svg
						class="birthday-cake"
						viewBox="0 0 420 400"
						role="img"
						aria-label={candlesOut ? "烛光已熄灭的樱花奶油蛋糕" : "点着三支蜡烛的樱花奶油蛋糕"}
					>
						<defs>
							<linearGradient id="bdcake-sponge" x1="0" y1="0" x2="0" y2="1">
								<stop stop-color="#f9c6cf"></stop>
								<stop offset="1" stop-color="#e28fa4"></stop>
							</linearGradient>
							<linearGradient id="bdcake-top" x1="0" y1="0" x2="0" y2="1">
								<stop stop-color="#ffe4e6"></stop>
								<stop offset="1" stop-color="#f3c3ca"></stop>
							</linearGradient>
							<linearGradient id="bdcake-icing" x1="0" y1="0" x2="0" y2="1">
								<stop stop-color="#fffdf6"></stop>
								<stop offset="1" stop-color="#f6e3d1"></stop>
							</linearGradient>
							<radialGradient id="bdcake-glow">
								<stop stop-color="#ffe6a3" stop-opacity=".8"></stop>
								<stop offset="1" stop-color="#ffe6a3" stop-opacity="0"></stop>
							</radialGradient>
							<linearGradient id="bdcake-flame" x1="0" y1="1" x2="0" y2="0">
								<stop stop-color="#f2ae45"></stop>
								<stop offset="1" stop-color="#ffe89a"></stop>
							</linearGradient>
							<clipPath id="bdcake-candle-0"><rect x="160" y="124" width="10" height="66" rx="4"></rect></clipPath>
							<clipPath id="bdcake-candle-1"><rect x="205" y="110" width="10" height="80" rx="4"></rect></clipPath>
							<clipPath id="bdcake-candle-2"><rect x="250" y="124" width="10" height="66" rx="4"></rect></clipPath>
						</defs>

						<path d="M32 40 Q210 92 390 40" fill="none" stroke="#d8b3a4" stroke-width="1.4"></path>
						<g class="bunting">
							<path d="M51 47 l18 0 l-9 21 z" fill="#e8a1b3"></path>
							<path d="M101 58 l18 0 l-9 21 z" fill="#b9c9a8"></path>
							<path d="M151 64 l18 0 l-9 21 z" fill="#f0c66e"></path>
							<path d="M201 66 l18 0 l-9 21 z" fill="#c9b4da"></path>
							<path d="M251 64 l18 0 l-9 21 z" fill="#e8a1b3"></path>
							<path d="M301 58 l18 0 l-9 21 z" fill="#b9c9a8"></path>
							<path d="M351 47 l18 0 l-9 21 z" fill="#f0c66e"></path>
						</g>

						<ellipse cx="212" cy="374" rx="146" ry="11" fill="#a56c73" opacity=".13"></ellipse>
						<path d="M178 356 h64 l10 16 h-84 z" fill="#ead0c2"></path>
						<ellipse cx="210" cy="372" rx="46" ry="7" fill="#e2c6b8"></ellipse>
						<ellipse cx="210" cy="352" rx="150" ry="24" fill="#e7cec0"></ellipse>
						<ellipse cx="210" cy="347" rx="150" ry="24" fill="#fff8ee"></ellipse>
						<g fill="#fffdf8" opacity=".9">
							<circle cx="82" cy="358" r="4.5"></circle>
							<circle cx="122" cy="366" r="4.5"></circle>
							<circle cx="166" cy="370" r="4.5"></circle>
							<circle cx="210" cy="371" r="4.5"></circle>
							<circle cx="254" cy="370" r="4.5"></circle>
							<circle cx="298" cy="366" r="4.5"></circle>
							<circle cx="338" cy="358" r="4.5"></circle>
						</g>

						<path d="M74 246 L74 316 C74 344 346 344 346 316 L346 246 Z" fill="url(#bdcake-sponge)"></path>
						<ellipse cx="210" cy="246" rx="136" ry="24" fill="url(#bdcake-top)"></ellipse>
						<g fill="url(#bdcake-icing)">
							<rect x="82" y="238" width="26" height="45" rx="13"></rect>
							<rect x="112" y="240" width="24" height="38" rx="12"></rect>
							<rect x="140" y="241" width="24" height="46" rx="12"></rect>
							<rect x="168" y="242" width="24" height="36" rx="12"></rect>
							<rect x="196" y="242" width="28" height="44" rx="14"></rect>
							<rect x="228" y="242" width="24" height="36" rx="12"></rect>
							<rect x="256" y="241" width="24" height="46" rx="12"></rect>
							<rect x="284" y="240" width="24" height="38" rx="12"></rect>
							<rect x="312" y="238" width="26" height="45" rx="13"></rect>
						</g>
						<ellipse cx="210" cy="244" rx="136" ry="24" fill="url(#bdcake-icing)"></ellipse>
						<path d="M74 300 C120 313 300 313 346 300" fill="none" stroke="#fff1e2" stroke-width="11" opacity=".55"></path>
						<g fill="#c76c83" opacity=".55">
							<circle cx="246" cy="282" r="4.2"></circle>
							<circle cx="318" cy="290" r="4.2"></circle>
							<circle cx="118" cy="290" r="4.2"></circle>
							<circle cx="160" cy="324" r="4.2"></circle>
							<circle cx="210" cy="330" r="4.2"></circle>
							<circle cx="266" cy="322" r="4.2"></circle>
							<circle cx="308" cy="308" r="4.2"></circle>
						</g>
						<g transform="translate(210 305)" fill="#c76c83" opacity=".72">
							<path d="M0 0 c-24 -15 -37 2 -19 11 c9 4 15 0 19 -6 z"></path>
							<path d="M0 0 c24 -15 37 2 19 11 c-9 4 -15 0 -19 -6 z"></path>
							<circle r="5"></circle>
						</g>

						<path d="M124 180 L124 240 C124 260 296 260 296 240 L296 180 Z" fill="url(#bdcake-top)"></path>
						<ellipse cx="210" cy="180" rx="86" ry="16" fill="#fff0e3"></ellipse>
						<g fill="url(#bdcake-icing)">
							<rect x="132" y="172" width="20" height="34" rx="10"></rect>
							<rect x="158" y="174" width="20" height="28" rx="10"></rect>
							<rect x="184" y="175" width="20" height="36" rx="10"></rect>
							<rect x="212" y="175" width="22" height="30" rx="11"></rect>
							<rect x="240" y="174" width="20" height="36" rx="10"></rect>
							<rect x="268" y="173" width="20" height="30" rx="10"></rect>
						</g>
						<ellipse cx="210" cy="178" rx="86" ry="16" fill="url(#bdcake-icing)"></ellipse>

						<g class="daisy" fill="#fffaf1">
							<circle cx="146" cy="214" r="4"></circle>
							<circle cx="156" cy="210" r="4"></circle>
							<circle cx="166" cy="214" r="4"></circle>
							<circle cx="156" cy="220" r="4"></circle>
							<circle cx="156" cy="215" r="3" fill="#e9b45c"></circle>
						</g>
						<g class="daisy" fill="#fffaf1">
							<circle cx="262" cy="216" r="4"></circle>
							<circle cx="272" cy="212" r="4"></circle>
							<circle cx="282" cy="216" r="4"></circle>
							<circle cx="272" cy="222" r="4"></circle>
							<circle cx="272" cy="217" r="3" fill="#e9b45c"></circle>
						</g>

						{#each candleSpots as spot, index}
							<g
								class="candle"
								class:out={!candles[index]}
								role="button"
								tabindex="0"
								aria-label={`第 ${index + 1} 支蜡烛，${candles[index] ? "点击吹灭" : "点击点亮"}`}
								onclick={() => toggleCandle(index)}
								onkeydown={(event) => onCandleKey(event, index)}
							>
								<rect
									class="candle-hit"
									x={spot.x - 20}
									y={spot.top - 44}
									width="40"
									height={226 - spot.top}
									fill="transparent"
								></rect>
								<rect
									x={spot.x - 5}
									y={spot.top}
									width="10"
									height={190 - spot.top}
									rx="4"
									fill={spot.color}
								></rect>
								<g clip-path={`url(#bdcake-candle-${index})`} stroke="#fff8ed" stroke-width="3" opacity=".9">
									<path d={`M${spot.x - 12} ${spot.top + 16} l24 -9`}></path>
									<path d={`M${spot.x - 12} ${spot.top + 32} l24 -9`}></path>
									<path d={`M${spot.x - 12} ${spot.top + 48} l24 -9`}></path>
									<path d={`M${spot.x - 12} ${spot.top + 64} l24 -9`}></path>
								</g>
								<path
									d={`M${spot.x} ${spot.top} v-7`}
									stroke="#8e6955"
									stroke-width="2"
									stroke-linecap="round"
								></path>
								<g class="flame">
									<circle class="flame-glow" cx={spot.x} cy={spot.top - 13} r="26" fill="url(#bdcake-glow)"></circle>
									<path
										d={`M${spot.x} ${spot.top - 35} C${spot.x - 10} ${spot.top - 25}, ${spot.x - 9} ${spot.top - 13}, ${spot.x} ${spot.top - 9} C${spot.x + 9} ${spot.top - 13}, ${spot.x + 10} ${spot.top - 25}, ${spot.x} ${spot.top - 35} Z`}
										fill="url(#bdcake-flame)"
									></path>
									<ellipse cx={spot.x} cy={spot.top - 18} rx="2.6" ry="5" fill="#fff7cf"></ellipse>
								</g>
								<circle
									class="candle-ring"
									cx={spot.x}
									cy={spot.top - 20}
									r="23"
									fill="none"
									stroke="var(--sakura)"
									stroke-width="1.4"
									stroke-dasharray="3 4"
								></circle>
								{#if !candles[index]}
									<g class="smoke" aria-hidden="true">
										<path
											d={`M${spot.x} ${spot.top - 10} c -6 -9 5 -15 0 -24`}
											fill="none"
											stroke-width="2"
											stroke-linecap="round"
										></path>
										<path
											d={`M${spot.x + 5} ${spot.top - 14} c 6 -7 -3 -12 2 -19`}
											fill="none"
											stroke-width="1.4"
											stroke-linecap="round"
											opacity=".6"
										></path>
									</g>
								{/if}
							</g>
						{/each}

						<g fill="#cf5f74">
							<circle cx="104" cy="334" r="8"></circle>
							<circle cx="316" cy="330" r="8"></circle>
							<path d="M104 326 c 6 -8 14 -9 18 -6" stroke="#8e6b57" stroke-width="1.6" fill="none"></path>
							<path d="M316 322 c -5 -8 -12 -9 -17 -6" stroke="#8e6b57" stroke-width="1.6" fill="none"></path>
							<circle cx="101" cy="331" r="2.2" fill="#fff3e6" opacity=".8"></circle>
							<circle cx="313" cy="327" r="2.2" fill="#fff3e6" opacity=".8"></circle>
						</g>
					</svg>
					<span class="cake-caption">a slice of happiness, just for you.</span>
				</div>

				{#if celebrating}
					{#key animationId}
						<div class="wish-sparkles" aria-hidden="true">
							{#each Array(12) as _, i}
								<span
									style={`--x: ${Math.cos((i * Math.PI) / 6) * (100 + (i % 3) * 25)}px; --y: ${Math.sin((i * Math.PI) / 6) * 110 - 65}px; --turn: ${i * 30}deg; --delay: ${i * 25}ms`}
									>{i % 3 === 0 ? "♡" : "✦"}</span
								>
							{/each}
						</div>
					{/key}
				{/if}
			</div>

			<div class="cake-actions intro" style="--intro-delay: 340ms">
				<button class="candle-button" type="button" onclick={blowCandles}>
					<span class="button-icon" aria-hidden="true">{candlesOut ? "🕯️" : "✧"}</span>
					{candlesOut ? "再点亮一次烛光" : "许个愿，吹灭蜡烛"}
				</button>
				{#if musicAvailable}
					<button
						class="music-button"
						class:playing={musicPlaying}
						type="button"
						aria-pressed={musicPlaying}
						onclick={toggleMusic}
					>
						<span class="music-eq" class:playing={musicPlaying} aria-hidden="true"><i></i><i></i><i></i></span>
						{musicPlaying ? "音乐盒 · 播放中" : "打开音乐盒"}
					</button>
				{/if}
			</div>
			<p class="cake-hint">也可以直接点一点蜡烛 · 三支都吹灭会有小惊喜</p>
			<p class="candle-status" role="status">
				{#if candlesOut}
					烛光已收好，愿你刚刚许下的心愿，都在未来慢慢实现。
				{:else if musicPlaying}
					一首很轻的生日歌，音量已经调低。
				{:else if musicHint}
					音乐盒准备好了，随时可以再放一次。
				{:else}
					闭上眼睛，把心愿悄悄留在烛光里。
				{/if}
			</p>
		</div>
	</section>

	<section class="chapter wish-chapter" use:reveal aria-labelledby="wish-title">
		<header class="chapter-head">
			<span class="chapter-badge" aria-hidden="true">01</span>
			<div class="chapter-title">
				<span class="chapter-kicker">MAKE A WISH</span>
				<h2 id="wish-title">捎来一份小小的祝福</h2>
				<p>不必长篇大论，一句心意就很温暖。</p>
			</div>
			<span class="chapter-mark" aria-hidden="true">❀</span>
		</header>

		<fieldset class="wish-options">
			<legend class="sr-only">选择一句生日祝福</legend>
			{#each wishes as wish, i}
				<label class="wish-card" class:selected={selected === i}>
					<input
						type="radio"
						name="birthday-wish"
						value={i}
						bind:group={selected}
						onchange={() => {
							sent = false;
						}}
					/>
					<span class="wish-top">
						<span class="wish-no" aria-hidden="true">0{i + 1}</span>
						<span class="wish-icon" aria-hidden="true">{wish.icon}</span>
						<span class="wish-check" aria-hidden="true">{selected === i ? "✓" : "+"}</span>
					</span>
					<span class="wish-card-title">{wish.title}</span>
					<span class="wish-card-copy">{wish.text}</span>
					<span class="wish-to" aria-hidden="true">TO · 今天的你</span>
				</label>
			{/each}
		</fieldset>

		<div class="send-row" bind:this={sendAnchor}>
			<p class="send-note">让这份祝福，在小屋里留下一点温度。</p>
			<button type="button" class="send-button" onclick={sendWish} disabled={celebrating}>
				<span aria-hidden="true">✦</span>
				{sent ? "再送一颗祝福星星" : "送出这份祝福"}
				<span aria-hidden="true">↗</span>
			</button>
		</div>
		<div class="wish-feedback" class:has-wish={sent} role="status" aria-atomic="true">
			{#if sent}
				{#key animationId}<span class="feedback-star" aria-hidden="true">✧</span>{/key}
				{wishes[selected].text}<span class="thank-you">谢谢你来陪 {name} 过生日 ♡</span>
			{:else}
				<span class="quiet-note">生日当天，或是平凡的一天，都欢迎你来坐坐。</span>
			{/if}
		</div>
	</section>

	<section class="chapter fortune-chapter" use:reveal aria-labelledby="fortune-title">
		<header class="chapter-head">
			<span class="chapter-badge" aria-hidden="true">02</span>
			<div class="chapter-title">
				<span class="chapter-kicker">A LITTLE FORTUNE</span>
				<h2 id="fortune-title">抽一张生日签</h2>
				<p>有点迷信，但今天允许。</p>
			</div>
			<span class="chapter-mark" aria-hidden="true">✦</span>
		</header>

		<div class="fortune-grid">
			<div class="fortune-copy">
				<p class="fortune-lead">不必太当真，把它当作今天的一点小暗示。抽中的那一句，只说给此刻的你听。</p>
				<blockquote class="fortune-quote">「许愿这件事，认真一点也无妨。」</blockquote>
				<button class="fortune-draw" type="button" onclick={drawFortune} disabled={fortuneBusy}>
					{fortuneFlipped ? "再抽一张" : "抽一张"}<span aria-hidden="true">↻</span>
				</button>
				<p class="fortune-count">
					{#if fortuneDraws === 0}
						签筒已经摆好了，第一签留给你。
					{:else}
						已经抽过 {fortuneDraws} 次 · 每一签都算数
					{/if}
				</p>
			</div>

			<button
				class="fortune-stage"
				class:flipped={fortuneFlipped}
				class:busy={fortuneBusy}
				type="button"
				onclick={drawFortune}
				aria-label={fortuneFlipped ? "再抽一张生日签" : "抽一张生日签"}
				aria-busy={fortuneBusy}
			>
				<span class="fortune-inner">
					<span class="fortune-face fortune-front" aria-hidden={fortuneFlipped}>
						<span class="fortune-corner corner-tl" aria-hidden="true">✧</span>
						<span class="fortune-corner corner-tr" aria-hidden="true">✧</span>
						<span class="fortune-corner corner-bl" aria-hidden="true">✧</span>
						<span class="fortune-corner corner-br" aria-hidden="true">✧</span>
						<span class="fortune-vertical">生日签</span>
						<span class="fortune-prompt">点一下 · 抽一支签</span>
						<span class="fortune-seal" aria-hidden="true">签</span>
					</span>
					<span class="fortune-face fortune-back" aria-hidden={!fortuneFlipped}>
						<span class="fortune-watermark" aria-hidden="true">签</span>
						<span class="fortune-tier"
							>{fortunes[fortuneIndex].tier}<i>·</i><b>NO.{pad(fortuneIndex + 1)}</b></span
						>
						<span class="fortune-body">{fortunes[fortuneIndex].text}</span>
						<span class="fortune-rule" aria-hidden="true"></span>
						<span class="fortune-advice">
							<span class="advice good">宜 {fortunes[fortuneIndex].yi}</span>
							<span class="advice bad">忌 {fortunes[fortuneIndex].ji}</span>
						</span>
						<span class="fortune-en">{fortunes[fortuneIndex].en}</span>
						<span class="fortune-again" aria-hidden="true">再抽一张 ↻</span>
					</span>
				</span>
			</button>
		</div>
		<p class="sr-only" aria-live="polite">
			{fortuneFlipped ? `抽到了${fortunes[fortuneIndex].tier}：${fortunes[fortuneIndex].text}` : ""}
		</p>
	</section>

	<section class="chapter letter-chapter" use:reveal aria-labelledby="letter-title">
		<header class="chapter-head">
			<span class="chapter-badge" aria-hidden="true">03</span>
			<div class="chapter-title">
				<span class="chapter-kicker">A LETTER, SEALED</span>
				<h2 id="letter-title">一封写给你的信</h2>
				<p>放在信封里很久了，今天拆开刚好。</p>
			</div>
			<span class="chapter-mark" aria-hidden="true">♡</span>
		</header>

		<div class="letter-grid" class:open={letterOpen}>
			<div class="letter-side">
				<p class="letter-side-lead">这封信没有地址，也不寄给谁，只是放在这里，等你来的时候拆开。</p>
				<p class="letter-side-note">写于农历九月十三 · 小屋的灯下</p>
				<button class="letter-button" type="button" aria-expanded={letterOpen} onclick={toggleLetter}>
					{letterOpen ? "把信收好" : "拆开信封"}
					<span aria-hidden="true">{letterOpen ? "↺" : "✉"}</span>
				</button>
				<div class="letter-postmark" aria-hidden="true">
					<span class="postmark-core">Y</span>
					<span class="postmark-text">农历九月十三<i>·</i>长沙<i>·</i>小屋</span>
				</div>
			</div>

			<div class="letter-area">
				<div class="envelope" aria-hidden="true">
					<span class="envelope-stamp"><i>09</i><i>13</i></span>
					<span class="envelope-pocket"></span>
					<span class="envelope-flap"></span>
					<span class="wax-seal">Y</span>
					<span class="envelope-to">TO · 你</span>
					<span class="tape tape-a"></span>
					<span class="tape tape-b"></span>
				</div>
				<div class="letter-reveal" aria-hidden={!letterOpen}>
					<div class="letter-inner">
						<article class="letter-paper">
							<span class="letter-postage" aria-hidden="true"><i>09</i><i>13</i></span>
							<p class="letter-hello">亲爱的你：</p>
							<p>见字如面。</p>
							<p>
								今天是我在农历上的生日。把这一天做成一个小房间，是想把「被记得」这件事，留得更久一点。
							</p>
							<p>
								这一年不算惊天动地，但也认真地爱过、写过、追过番，在深夜里和自己和解过几次。如果愿望真的会实现，我希望身边的人平安，也希望自己还有力气去期待下一件小事。
							</p>
							<p>
								谢谢你点开这一页。无论今天是不是你的生日，都祝你：有甜可吃，有人可爱，有事可期待。
							</p>
							<p>生日快乐，也祝你今天有个好心情。</p>
							<p class="letter-sign">{name}<small>农历九月十三 · 于小屋</small></p>
							<p class="letter-ps">P.S. 蛋糕免费，愿望要自己许。</p>
						</article>
					</div>
				</div>
			</div>
		</div>
	</section>

	<footer class="room-footer">
		<span class="footer-mark" aria-hidden="true">୨୧</span>
		<p>日落尤其温暖，人间皆是热爱。</p>
		<span class="footer-note">这一岁，也请慢慢来。</span>
	</footer>
	<noscript>
		<p class="noscript-note">每年农历九月十三都是生日。开启 JavaScript 后，可以查看倒计时、吹蜡烛、抽签和拆信。</p>
	</noscript>
</div>

<style>
	.birthday-room {
		--line: color-mix(in srgb, var(--tea) 15%, transparent);
		--line-strong: color-mix(in srgb, var(--tea) 26%, transparent);
		--line-soft: color-mix(in srgb, var(--tea) 9%, transparent);
		--sakura-soft: color-mix(in srgb, var(--sakura) 10%, transparent);
		--sakura-mid: color-mix(in srgb, var(--sakura) 30%, transparent);
		--display: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Songti SC", "Noto Serif CJK SC",
			"Source Han Serif SC", SimSun, serif;
		--serif-cn: "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif;
		--hand: "Segoe Script", "Bradley Hand", "Kaiti SC", KaiTi, "STKaiti", cursive;
		position: relative;
		isolation: isolate;
		color: var(--text-strong);
		padding: clamp(1.2rem, 2.6vw, 2rem) clamp(1.1rem, 4vw, 3.5rem) clamp(1.6rem, 3vw, 2.5rem);
		background:
			radial-gradient(120% 80% at 92% -10%, color-mix(in srgb, var(--sakura) 13%, transparent), transparent 62%),
			radial-gradient(90% 60% at 0% 45%, color-mix(in srgb, var(--tea) 7%, transparent), transparent 66%),
			var(--glass-card);
		border: 1px solid var(--glass-border);
		border-radius: calc(var(--radius-large) + 0.35rem);
		box-shadow:
			0 2rem 5rem -3rem rgba(118, 80, 68, 0.32),
			0 0.25rem 1rem -0.5rem rgba(118, 80, 68, 0.14);
		overflow: hidden;
	}
	.birthday-room::before {
		content: "";
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background-image: radial-gradient(color-mix(in srgb, var(--tea) 20%, transparent) 0.6px, transparent 0.9px);
		background-size: 13px 13px;
		opacity: 0.14;
		mask-image: linear-gradient(to bottom, black, transparent 55%);
	}
	.room-atmosphere {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.glow {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
	}
	.glow-one {
		width: 26rem;
		height: 26rem;
		right: -8rem;
		top: -6rem;
		background: radial-gradient(circle, color-mix(in srgb, var(--sakura) 22%, transparent), transparent 70%);
	}
	.glow-two {
		width: 32rem;
		height: 32rem;
		left: -12rem;
		top: 46%;
		background: radial-gradient(circle, color-mix(in srgb, var(--tea) 12%, transparent), transparent 70%);
	}
	.petal {
		position: absolute;
		top: -3rem;
		width: var(--size);
		height: calc(var(--size) * 1.45);
		border-radius: 90% 8% 90% 8%;
		background: linear-gradient(
			140deg,
			color-mix(in srgb, var(--sakura) 60%, transparent),
			color-mix(in srgb, var(--sakura) 26%, transparent)
		);
		opacity: 0;
		animation: petal-fall var(--fall-duration) linear infinite;
		animation-delay: var(--fall-delay);
	}
	.room-frame {
		position: absolute;
		inset: 0.55rem;
		z-index: 3;
		border: 1px dashed color-mix(in srgb, var(--sakura) 22%, transparent);
		border-radius: calc(var(--radius-large) - 0.1rem);
		pointer-events: none;
	}
	.confetti-canvas {
		position: fixed;
		inset: 0;
		z-index: 9;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.room-topline {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.2rem 0 1.15rem;
		border-bottom: 1px dashed var(--line);
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.room-topline a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-body);
	}
	.room-topline a:hover {
		color: var(--sakura);
	}
	.topline-center {
		font-family: var(--display);
		font-style: italic;
		letter-spacing: 0.02em;
		color: color-mix(in srgb, var(--tea) 78%, var(--text-muted));
	}
	.topline-right {
		font-variant-numeric: tabular-nums;
	}

	.birthday-hero {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
		align-items: center;
		gap: clamp(1rem, 3vw, 2.5rem);
		padding: clamp(2.2rem, 4.8vw, 4rem) 0 clamp(1.8rem, 3.5vw, 2.8rem);
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-bottom: 1.1rem;
		font-size: 0.6rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.eyebrow-line {
		width: 2.2rem;
		height: 1px;
		background: color-mix(in srgb, var(--sakura) 55%, transparent);
	}
	.eyebrow-star {
		color: var(--sakura);
		font-size: 0.85rem;
		letter-spacing: 0;
	}
	.eyebrow-text {
		white-space: nowrap;
	}
	.eyebrow-no {
		margin-left: auto;
		letter-spacing: 0.14em;
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}
	.date-tag {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.68rem;
		color: var(--text-body);
	}
	.date-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--sakura);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--sakura) 16%, transparent);
	}
	.tag-separator {
		color: var(--text-muted);
	}
	.hero-copy h1 {
		margin: 1rem 0 1.2rem;
		font-family: var(--display);
		font-size: clamp(3rem, 5.2vw, 5.1rem);
		font-weight: 400;
		line-height: 0.99;
		letter-spacing: -0.055em;
	}
	.birthday-name {
		position: relative;
		display: inline-block;
		padding-right: 0.15rem;
		color: var(--sakura);
		font-style: italic;
	}
	.name-underline {
		position: absolute;
		left: -0.1rem;
		right: -0.2rem;
		bottom: -0.62rem;
		width: calc(100% + 0.3rem);
		height: 0.7rem;
		overflow: visible;
	}
	.name-underline path {
		fill: none;
		stroke: color-mix(in srgb, var(--sakura) 55%, transparent);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-dasharray: 280;
		stroke-dashoffset: 280;
		animation: draw-underline 1.15s cubic-bezier(0.2, 0.8, 0.2, 1) 0.55s forwards;
	}
	.title-star {
		display: inline-block;
		margin-left: 0.55rem;
		color: var(--sakura);
		font-size: clamp(1rem, 1.6vw, 1.5rem);
		vertical-align: 0.7em;
		animation: star-twinkle 4.2s ease-in-out infinite;
	}
	.hero-description {
		max-width: 24rem;
		font-size: 0.85rem;
		line-height: 2;
		color: var(--text-body);
		text-wrap: pretty;
	}
	.hero-today-tip {
		margin-top: 0.9rem;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.72rem;
		letter-spacing: 0.03em;
		color: var(--text-muted);
	}
	.hero-today-tip span {
		padding: 0 0.3rem;
		color: var(--sakura);
	}
	.meta-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 1.1rem;
	}
	.meta-pill {
		padding: 0.28rem 0.65rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: color-mix(in srgb, var(--cream-base) 60%, transparent);
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.today-card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem;
		margin-top: 1.6rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--sakura-mid);
		border-left: 3px solid var(--sakura);
		border-radius: 0.7rem;
		background: linear-gradient(100deg, var(--sakura-soft), transparent 80%);
	}
	.today-icon {
		font-size: 1.6rem;
		line-height: 1;
	}
	.today-copy strong {
		display: block;
		color: var(--sakura);
		font-size: 0.95rem;
		font-weight: 600;
	}
	.today-copy p {
		margin-top: 0.2rem;
		font-size: 0.7rem;
		color: var(--text-body);
	}
	.firework-button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
		padding: 0.45rem 0.8rem;
		border: 1px dashed var(--sakura-mid);
		border-radius: 999px;
		background: transparent;
		color: var(--sakura);
		font-size: 0.66rem;
		transition: background 0.25s, border-color 0.25s;
	}
	.firework-button:hover {
		border-color: var(--sakura);
		background: var(--sakura-soft);
	}
	.countdown-card {
		max-width: 27rem;
		margin-top: 1.6rem;
		padding: 0.95rem 1.1rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cream-base) 88%, transparent),
			color-mix(in srgb, var(--cream-soft) 60%, transparent)
		);
		box-shadow: 0 0.6rem 1.8rem -1.2rem rgba(118, 80, 68, 0.4);
	}
	.countdown-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.countdown-zone {
		letter-spacing: 0.18em;
		opacity: 0.75;
	}
	.countdown {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 0.55rem 0 0.45rem;
		font-variant-numeric: tabular-nums;
	}
	.cd-unit {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.18rem;
		padding: 0.15rem 0;
		border-right: 1px dashed var(--line);
	}
	.cd-unit:last-child {
		border-right: 0;
	}
	.cd-unit b {
		display: inline-block;
		font-family: var(--display);
		font-size: clamp(1.5rem, 2.4vw, 1.9rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}
	.cd-unit small {
		font-size: 0.6rem;
		color: var(--text-muted);
	}
	.cd-sec {
		animation: digit-tick 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.countdown-foot {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding-top: 0.55rem;
		border-top: 1px dotted var(--line);
		font-size: 0.62rem;
		color: var(--text-muted);
	}
	.foot-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--sakura);
	}
	.calendar-placeholder {
		margin-top: 1.8rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.cake-side {
		position: relative;
		z-index: 1;
		text-align: center;
	}
	.cake-orbit {
		position: relative;
		display: grid;
		place-items: center;
		width: min(100%, 29rem);
		aspect-ratio: 1;
		margin: 0 auto;
	}
	.orbit-text {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		color: var(--text-muted);
		animation: orbit-spin 90s linear infinite;
	}
	.orbit-text text {
		fill: currentColor;
		font-family: var(--display);
		font-size: 12px;
		letter-spacing: 4px;
		opacity: 0.6;
	}
	.cake-halo {
		position: absolute;
		width: 72%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in srgb, var(--sakura) 19%, transparent), transparent 68%);
		animation: halo-pulse 6s ease-in-out infinite;
	}
	.orbit-spark {
		position: absolute;
		color: var(--sakura);
		line-height: 1;
		animation: star-twinkle 4.6s ease-in-out infinite;
	}
	.spark-one {
		top: 15%;
		left: 8%;
		font-size: 1.3rem;
	}
	.spark-two {
		top: 20%;
		right: 7%;
		font-size: 1rem;
		animation-delay: -1.5s;
	}
	.spark-three {
		bottom: 22%;
		right: 14%;
		font-size: 1.1rem;
		animation-delay: -2.8s;
	}
	.cake-stage {
		position: relative;
		width: min(84%, 21rem);
	}
	.cake-note {
		display: block;
		margin-bottom: -0.3rem;
		font-family: var(--display);
		font-style: italic;
		font-size: 1.05rem;
		color: var(--tea);
		transform: rotate(-6deg);
	}
	.birthday-cake {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		filter: drop-shadow(0 1.2rem 1.4rem rgba(183, 131, 131, 0.15));
		animation: cake-bob 6.5s ease-in-out infinite;
	}
	.cake-caption {
		display: block;
		margin-top: -0.4rem;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.candle {
		cursor: pointer;
		outline: none;
	}
	.candle .flame {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: flame-flicker 1.5s ease-in-out infinite alternate;
		animation-delay: var(--flicker-delay, 0s);
		transition: opacity 0.3s ease, transform 0.35s ease;
	}
	.candle .flame-glow {
		animation: flame-glow 2.6s ease-in-out infinite;
	}
	.candle.out .flame {
		opacity: 0;
		transform: scale(0.35);
		animation: none;
	}
	.candle.out .flame-glow {
		opacity: 0;
		transition: opacity 0.4s;
	}
	.candle:hover .flame {
		filter: brightness(1.08);
	}
	.candle-ring {
		opacity: 0;
		transition: opacity 0.2s;
	}
	.candle:focus-visible .candle-ring {
		opacity: 0.9;
	}
	.candle .smoke path {
		stroke: color-mix(in srgb, var(--text-muted) 70%, transparent);
		opacity: 0;
		animation: smoke-rise 1.9s ease-out both;
	}
	.candle .smoke path:last-child {
		animation-delay: 0.12s;
	}
	.cake-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.55rem;
		margin-top: 0.3rem;
	}
	button {
		font: inherit;
		cursor: pointer;
	}
	.candle-button,
	.music-button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.62rem 1.1rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: color-mix(in srgb, var(--cream-base) 85%, transparent);
		color: var(--text-strong);
		font-size: 0.76rem;
		transition: border-color 0.25s, background 0.25s, transform 0.25s, color 0.25s;
	}
	.candle-button:hover,
	.music-button:hover {
		border-color: var(--sakura);
		background: var(--sakura-soft);
		transform: translateY(-1px);
	}
	.button-icon {
		color: var(--sakura);
	}
	.music-eq {
		display: inline-flex;
		align-items: flex-end;
		gap: 2px;
		height: 0.75rem;
	}
	.music-eq i {
		width: 2px;
		height: 30%;
		border-radius: 2px;
		background: var(--sakura);
		opacity: 0.65;
	}
	.music-eq.playing i {
		animation: eq-bounce 0.9s ease-in-out infinite alternate;
	}
	.music-eq.playing i:nth-child(2) {
		animation-delay: -0.3s;
	}
	.music-eq.playing i:nth-child(3) {
		animation-delay: -0.6s;
	}
	.music-button.playing {
		border-color: var(--sakura-mid);
		background: var(--sakura-soft);
		color: var(--sakura);
	}
	.cake-hint {
		margin-top: 0.65rem;
		font-size: 0.62rem;
		color: var(--text-muted);
	}
	.candle-status {
		min-height: 2.6em;
		margin-top: 0.35rem;
		font-size: 0.64rem;
		line-height: 1.8;
		color: var(--text-muted);
	}

	.chapter {
		position: relative;
		z-index: 1;
		margin-top: clamp(2.4rem, 4vw, 3.4rem);
		padding-top: clamp(2.2rem, 3.6vw, 3rem);
		border-top: 1px dashed var(--line-strong);
	}
	.chapter::before {
		content: "✧";
		position: absolute;
		top: -0.7rem;
		left: 50%;
		padding: 0 0.7rem;
		background: color-mix(in srgb, var(--cream-base) 88%, transparent);
		border-radius: 999px;
		color: var(--sakura);
		font-size: 0.78rem;
		transform: translateX(-50%);
	}
	.chapter-head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: 1rem;
		margin-bottom: 1.6rem;
	}
	.chapter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.4rem;
		border: 1px solid var(--sakura-mid);
		border-radius: 50%;
		background: color-mix(in srgb, var(--sakura) 6%, transparent);
		color: var(--sakura);
		font-family: var(--display);
		font-style: italic;
		font-size: 0.9rem;
	}
	.chapter-kicker {
		display: block;
		margin-bottom: 0.4rem;
		font-size: 0.56rem;
		letter-spacing: 0.22em;
		color: var(--text-muted);
	}
	.chapter-title h2 {
		font-size: clamp(1.2rem, 1.8vw, 1.45rem);
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.chapter-title p {
		margin-top: 0.45rem;
		font-size: 0.74rem;
		color: var(--text-muted);
	}
	.chapter-mark {
		color: var(--sakura);
		font-size: 2rem;
		line-height: 1;
		opacity: 0.85;
		font-variant-emoji: text;
	}

	.wish-options {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.9rem;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.wish-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.1rem 1.1rem 0.95rem;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cream-base) 78%, transparent),
			color-mix(in srgb, var(--cream-soft) 55%, transparent)
		);
		cursor: pointer;
		transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.25s, box-shadow 0.35s,
			background 0.25s;
	}
	.wish-card::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 25%,
			color-mix(in srgb, var(--sakura) 16%, transparent) 45%,
			transparent 65%
		);
		transform: translateX(-120%);
		transition: transform 0.85s ease;
		pointer-events: none;
	}
	.wish-card:hover {
		transform: translateY(-4px);
		border-color: var(--sakura-mid);
		box-shadow: 0 1rem 2rem -1.2rem rgba(118, 80, 68, 0.35);
	}
	.wish-card:hover::after {
		transform: translateX(120%);
	}
	.wish-card.selected {
		border-color: color-mix(in srgb, var(--sakura) 65%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--sakura) 12%, var(--cream-base)),
			color-mix(in srgb, var(--cream-soft) 60%, transparent)
		);
		box-shadow: 0 0.8rem 1.8rem -1.2rem color-mix(in srgb, var(--sakura) 55%, transparent);
	}
	.wish-card.selected::before {
		content: "";
		position: absolute;
		inset: 0 0 auto;
		height: 2px;
		background: linear-gradient(90deg, transparent, var(--sakura), transparent);
	}
	.wish-card input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.wish-card:focus-within {
		outline: 2px solid var(--sakura);
		outline-offset: 4px;
	}
	.wish-top {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.wish-no {
		font-family: var(--display);
		font-style: italic;
		font-size: 0.7rem;
		color: var(--text-muted);
	}
	.wish-icon {
		font-size: 1.5rem;
		line-height: 1;
	}
	.wish-check {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		margin-left: auto;
		border: 1px dashed var(--line-strong);
		border-radius: 50%;
		color: var(--text-muted);
		font-size: 0.68rem;
		transition: background 0.25s, color 0.25s, border-color 0.25s, transform 0.25s;
	}
	.wish-card.selected .wish-check {
		border-color: var(--sakura);
		border-style: solid;
		background: var(--sakura);
		color: var(--cream-base);
		transform: rotate(-8deg);
	}
	.wish-card-title {
		font-size: 0.98rem;
		font-weight: 600;
		color: var(--text-strong);
	}
	.wish-card-copy {
		font-size: 0.75rem;
		line-height: 1.9;
		color: var(--text-body);
	}
	.wish-to {
		margin-top: auto;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		color: var(--text-muted);
	}
	.send-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.35rem;
	}
	.send-note {
		font-size: 0.7rem;
		color: var(--text-muted);
	}
	.send-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		padding: 0.8rem 1.2rem;
		border: 1px solid transparent;
		border-radius: 999px;
		background: linear-gradient(120deg, var(--sakura), color-mix(in srgb, var(--sakura) 78%, var(--tea)));
		box-shadow: 0 0.7rem 1.4rem -0.9rem color-mix(in srgb, var(--sakura) 70%, transparent);
		color: var(--cream-base);
		font-size: 0.78rem;
		transition: filter 0.2s, transform 0.25s, box-shadow 0.25s;
	}
	.send-button:hover {
		filter: brightness(0.97);
		transform: translateY(-1px);
		box-shadow: 0 1rem 1.8rem -0.9rem color-mix(in srgb, var(--sakura) 75%, transparent);
	}
	.send-button:disabled {
		opacity: 0.7;
		cursor: default;
		transform: none;
	}
	button:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--sakura);
		outline-offset: 4px;
	}
	.wish-feedback {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 3.4rem;
		margin-top: 0.9rem;
		padding: 0.75rem 1rem;
		border-radius: 0.7rem;
		text-align: center;
		font-size: 0.78rem;
		line-height: 1.9;
		color: var(--text-body);
	}
	.wish-feedback.has-wish {
		background: color-mix(in srgb, var(--sakura) 7%, transparent);
	}
	.thank-you {
		flex-basis: 100%;
		font-size: 0.68rem;
		color: var(--text-muted);
	}
	.feedback-star {
		display: inline-block;
		color: var(--sakura);
		font-size: 1.2rem;
		animation: feedback-twinkle 1.2s ease-out;
	}
	.quiet-note {
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.fortune-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
		align-items: center;
		gap: clamp(1.2rem, 3vw, 2.6rem);
	}
	.fortune-lead {
		max-width: 24rem;
		font-size: 0.8rem;
		line-height: 2;
		color: var(--text-body);
		text-wrap: pretty;
	}
	.fortune-quote {
		max-width: 23rem;
		margin: 1.1rem 0 1.3rem;
		padding-left: 0.9rem;
		border-left: 2px solid var(--sakura-mid);
		font-family: var(--serif-cn);
		font-size: 0.8rem;
		line-height: 1.95;
		color: var(--text-muted);
	}
	.fortune-draw {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.66rem 1.15rem;
		border: 1px solid var(--sakura-mid);
		border-radius: 999px;
		background: var(--sakura-soft);
		color: var(--sakura);
		font-size: 0.76rem;
		transition: background 0.25s, border-color 0.25s, transform 0.25s;
	}
	.fortune-draw:hover {
		border-color: var(--sakura);
		background: color-mix(in srgb, var(--sakura) 15%, transparent);
		transform: translateY(-1px);
	}
	.fortune-draw:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.fortune-count {
		margin-top: 0.6rem;
		font-size: 0.62rem;
		color: var(--text-muted);
	}
	.fortune-stage {
		display: block;
		width: 100%;
		aspect-ratio: 1.32;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		perspective: 1400px;
		-webkit-tap-highlight-color: transparent;
	}
	.fortune-stage.busy {
		animation: fortune-shake 0.5s ease-in-out;
	}
	.fortune-inner {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform 0.95s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.fortune-stage.flipped .fortune-inner {
		transform: rotateY(180deg);
	}
	.fortune-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--line-strong);
		border-radius: 1rem;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		box-shadow: 0 1.4rem 3rem -2rem rgba(118, 80, 68, 0.45);
	}
	.fortune-front {
		align-items: center;
		justify-content: center;
		gap: 0.9rem;
		background: repeating-linear-gradient(
				45deg,
				color-mix(in srgb, var(--sakura) 5%, transparent) 0 10px,
				transparent 10px 20px
			),
			linear-gradient(
				160deg,
				color-mix(in srgb, var(--cream-base) 92%, transparent),
				color-mix(in srgb, var(--cream-soft) 70%, transparent)
			);
	}
	.fortune-front::before {
		content: "";
		position: absolute;
		inset: 0.7rem;
		border: 1px dashed var(--sakura-mid);
		border-radius: 0.65rem;
		pointer-events: none;
	}
	.fortune-corner {
		position: absolute;
		color: var(--sakura);
		font-size: 0.72rem;
		opacity: 0.65;
	}
	.corner-tl {
		top: 1rem;
		left: 1rem;
	}
	.corner-tr {
		top: 1rem;
		right: 1rem;
	}
	.corner-bl {
		bottom: 1rem;
		left: 1rem;
	}
	.corner-br {
		bottom: 1rem;
		right: 1rem;
	}
	.fortune-vertical {
		font-family: var(--serif-cn);
		font-size: clamp(1.7rem, 3vw, 2.3rem);
		letter-spacing: 0.35em;
		line-height: 1;
		writing-mode: vertical-rl;
		text-orientation: upright;
		color: var(--text-strong);
	}
	.fortune-prompt {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		color: var(--text-muted);
	}
	.fortune-seal {
		position: absolute;
		right: 1.5rem;
		bottom: 1.5rem;
		display: grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		border: 1.5px solid color-mix(in srgb, var(--sakura) 70%, transparent);
		border-radius: 0.3rem;
		color: var(--sakura);
		font-family: var(--serif-cn);
		font-size: 0.85rem;
		transform: rotate(6deg);
	}
	.fortune-back {
		justify-content: center;
		align-items: flex-start;
		gap: 0.75rem;
		padding: clamp(1.4rem, 3vw, 2.2rem) clamp(1.3rem, 2.8vw, 2.1rem);
		background: linear-gradient(
			170deg,
			color-mix(in srgb, var(--cream-base) 95%, transparent),
			color-mix(in srgb, var(--sakura) 8%, var(--cream-soft))
		);
		transform: rotateY(180deg);
	}
	.fortune-back::before {
		content: "";
		position: absolute;
		inset: 0.7rem;
		border: 1px dashed var(--line-strong);
		border-radius: 0.65rem;
		pointer-events: none;
	}
	.fortune-watermark {
		position: absolute;
		right: clamp(0.6rem, 2.5vw, 2.2rem);
		top: 50%;
		transform: translateY(-50%) rotate(-8deg);
		font-family: var(--serif-cn);
		font-size: clamp(5.5rem, 9vw, 8.5rem);
		line-height: 1;
		color: color-mix(in srgb, var(--sakura) 9%, transparent);
		pointer-events: none;
		user-select: none;
	}
	.fortune-tier {
		position: absolute;
		top: clamp(1.2rem, 2.4vw, 1.7rem);
		left: clamp(1.4rem, 3vw, 2.2rem);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.6rem;
		letter-spacing: 0.2em;
		color: var(--sakura);
	}
	.fortune-tier i {
		font-style: normal;
		color: var(--text-muted);
	}
	.fortune-tier b {
		font-weight: 500;
		letter-spacing: 0.12em;
		color: var(--text-muted);
	}
	.fortune-body {
		position: relative;
		max-width: 82%;
		font-family: var(--serif-cn);
		font-size: clamp(0.98rem, 1.6vw, 1.18rem);
		line-height: 1.95;
		letter-spacing: 0.02em;
		color: var(--text-strong);
	}
	.fortune-rule {
		position: relative;
		width: 2.2rem;
		height: 1px;
		background: var(--sakura-mid);
	}
	.fortune-advice {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.advice {
		padding: 0.24rem 0.6rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		font-size: 0.64rem;
		color: var(--text-muted);
	}
	.advice.good {
		border-color: var(--sakura-mid);
		background: var(--sakura-soft);
		color: var(--sakura);
	}
	.fortune-en {
		position: relative;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.68rem;
		color: var(--text-muted);
	}
	.fortune-again {
		position: absolute;
		right: clamp(1.2rem, 2.6vw, 1.9rem);
		bottom: clamp(1rem, 2.1vw, 1.45rem);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		color: var(--text-muted);
	}

	.letter-grid {
		display: grid;
		grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
		align-items: start;
		gap: clamp(1.2rem, 3vw, 2.4rem);
	}
	.letter-side {
		padding-top: 0.4rem;
	}
	.letter-side-lead {
		max-width: 21rem;
		font-size: 0.8rem;
		line-height: 2;
		color: var(--text-body);
		text-wrap: pretty;
	}
	.letter-side-note {
		margin-top: 0.8rem;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.68rem;
		color: var(--text-muted);
	}
	.letter-button {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 1.2rem;
		padding: 0.66rem 1.1rem;
		border: 1px solid var(--sakura-mid);
		border-radius: 999px;
		background: var(--sakura-soft);
		color: var(--sakura);
		font-size: 0.76rem;
		transition: background 0.25s, border-color 0.25s, transform 0.25s;
	}
	.letter-button:hover {
		border-color: var(--sakura);
		background: color-mix(in srgb, var(--sakura) 15%, transparent);
		transform: translateY(-1px);
	}
	.letter-postmark {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: max-content;
		max-width: 100%;
		margin-top: 1.5rem;
		padding: 0.55rem 0.9rem 0.55rem 0.55rem;
		border: 1px dashed color-mix(in srgb, var(--sakura) 45%, transparent);
		border-radius: 0.4rem;
		color: color-mix(in srgb, var(--sakura) 75%, var(--text-muted));
		transform: rotate(-2.5deg);
	}
	.letter-postmark::before {
		content: "";
		position: absolute;
		inset: 0.2rem;
		border: 1px solid color-mix(in srgb, var(--sakura) 20%, transparent);
		border-radius: 0.25rem;
		pointer-events: none;
	}
	.postmark-core {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid currentColor;
		border-radius: 50%;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.95rem;
	}
	.postmark-text {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.15rem 0.35rem;
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		line-height: 1.6;
	}
	.postmark-text i {
		font-style: normal;
		opacity: 0.5;
	}
	.letter-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}
	.envelope {
		position: relative;
		width: min(24rem, 100%);
		height: 14.5rem;
		margin: 0 auto 1rem;
		transition: height 0.55s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease, margin 0.5s ease;
	}
	.open .envelope {
		height: 0;
		margin-bottom: 0;
		opacity: 0;
	}
	.envelope-pocket {
		position: absolute;
		inset: 0;
		border: 1px solid var(--line-strong);
		border-radius: 0.6rem;
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--cream-base) 96%, var(--sakura)),
			color-mix(in srgb, var(--cream-soft) 80%, var(--sakura))
		);
		box-shadow: 0 1.2rem 2rem -1.4rem rgba(118, 80, 68, 0.45);
	}
	.envelope-pocket::after {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: 0.6rem;
		background: linear-gradient(150deg, transparent 48%, color-mix(in srgb, var(--sakura) 9%, transparent) 50%),
			linear-gradient(-150deg, transparent 48%, color-mix(in srgb, var(--sakura) 9%, transparent) 50%);
	}
	.envelope-flap {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2;
		height: 58%;
		border-radius: 0.6rem 0.6rem 0 0;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cream-base) 94%, var(--sakura)),
			color-mix(in srgb, var(--cream-soft) 86%, var(--sakura))
		);
		clip-path: polygon(0 0, 100% 0, 50% 100%);
		filter: drop-shadow(0 2px 3px rgba(118, 80, 68, 0.12));
	}
	.wax-seal {
		position: absolute;
		top: 48%;
		left: 50%;
		z-index: 3;
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 2px solid color-mix(in srgb, #fff6ef 35%, transparent);
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #e394a6, #c2607a 60%, #a94a63);
		box-shadow: 0 0.3rem 0.7rem -0.2rem rgba(126, 54, 74, 0.5);
		color: #fff4ef;
		font-family: var(--display);
		font-style: italic;
		font-size: 1rem;
		transform: translate(-50%, -50%) rotate(-6deg);
	}
	.envelope-to {
		position: absolute;
		left: 1.2rem;
		bottom: 0.9rem;
		z-index: 2;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		color: var(--text-muted);
	}
	.envelope-stamp {
		position: absolute;
		top: 0.8rem;
		right: 0.9rem;
		z-index: 3;
		display: grid;
		place-items: center;
		width: 2.3rem;
		height: 2.8rem;
		border: 1px dashed color-mix(in srgb, var(--sakura) 55%, transparent);
		border-radius: 0.15rem;
		background: color-mix(in srgb, var(--cream-base) 80%, transparent);
		color: var(--sakura);
		font-family: var(--display);
		font-size: 0.58rem;
		line-height: 1.3;
	}
	.envelope-stamp i {
		font-style: normal;
	}
	.tape {
		position: absolute;
		z-index: 4;
		width: 5rem;
		height: 1.35rem;
		background: color-mix(in srgb, var(--sakura) 22%, transparent);
		clip-path: polygon(3% 0, 100% 0, 97% 100%, 0 100%);
		opacity: 0.75;
	}
	.tape-a {
		top: -0.55rem;
		left: -1rem;
		transform: rotate(-14deg);
	}
	.tape-b {
		bottom: -0.55rem;
		right: -1rem;
		transform: rotate(-14deg);
	}
	.letter-reveal {
		display: grid;
		grid-template-rows: 0fr;
		width: 100%;
		transition: grid-template-rows 0.8s cubic-bezier(0.3, 0.9, 0.3, 1);
	}
	.open .letter-reveal {
		grid-template-rows: 1fr;
	}
	.letter-inner {
		overflow: hidden;
	}
	.letter-paper {
		position: relative;
		max-width: 34rem;
		margin: 0 auto;
		padding: clamp(1.5rem, 3vw, 2.4rem) clamp(1.4rem, 3vw, 2.6rem);
		border: 1px solid var(--line-strong);
		border-radius: 0.45rem;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cream-base) 97%, transparent),
			color-mix(in srgb, var(--cream-soft) 80%, transparent)
		);
		box-shadow: 0 1.8rem 3.4rem -2.2rem rgba(118, 80, 68, 0.4);
		font-family: var(--serif-cn);
		font-size: 0.9rem;
		line-height: 2.15;
		color: var(--text-body);
		opacity: 0;
		transform: translateY(-14px) scale(0.985);
		transition: opacity 0.5s ease 0.1s, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s;
	}
	.letter-paper::before {
		content: "";
		position: absolute;
		top: 1.3rem;
		bottom: 1.3rem;
		left: 1.15rem;
		width: 1px;
		background: color-mix(in srgb, var(--sakura) 24%, transparent);
	}
	.open .letter-paper {
		opacity: 1;
		transform: none;
	}
	.letter-paper p {
		margin-bottom: 0.85rem;
	}
	.letter-paper p:last-child {
		margin-bottom: 0;
	}
	.letter-hello {
		font-weight: 600;
		color: var(--text-strong);
	}
	.letter-postage {
		position: absolute;
		top: 1.1rem;
		right: 1.2rem;
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.9rem;
		border: 1px dashed color-mix(in srgb, var(--sakura) 45%, transparent);
		border-radius: 0.15rem;
		background: color-mix(in srgb, var(--sakura) 6%, transparent);
		color: var(--sakura);
		font-family: var(--display);
		font-size: 0.56rem;
		line-height: 1.3;
		transform: rotate(4deg);
	}
	.letter-postage i {
		font-style: normal;
	}
	.letter-sign {
		margin-top: 1.2rem;
		text-align: right;
		font-family: var(--hand);
		font-size: 1.45rem;
		line-height: 1.4;
		color: var(--tea);
	}
	.letter-sign small {
		display: block;
		margin-top: 0.3rem;
		font-family: var(--serif-cn);
		font-size: 0.64rem;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.letter-ps {
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px dashed var(--line);
		font-size: 0.76rem;
		color: var(--text-muted);
	}

	.room-footer {
		position: relative;
		z-index: 1;
		display: grid;
		justify-items: center;
		gap: 0.45rem;
		margin-top: 2.2rem;
		padding-top: 1.6rem;
		border-top: 1px dashed var(--line);
	}
	.footer-mark {
		color: var(--sakura);
		font-size: 1.5rem;
	}
	.room-footer p {
		font-size: 0.78rem;
		letter-spacing: 0.1em;
		color: var(--text-body);
	}
	.footer-note {
		font-size: 0.64rem;
		color: var(--text-muted);
	}
	.noscript-note {
		margin-top: 1.5rem;
		font-size: 0.8rem;
		color: var(--text-body);
	}

	.wish-sparkles {
		position: absolute;
		top: 55%;
		left: 50%;
		pointer-events: none;
	}
	.wish-sparkles span {
		position: absolute;
		color: var(--sakura);
		font-size: 1.5rem;
		animation: birthday-sparkle 1.15s ease-out both;
		animation-delay: var(--delay);
	}

	.reveal.in-view {
		animation: reveal-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: var(--reveal-delay, 0ms);
	}
	.intro {
		animation: intro-rise 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: var(--intro-delay, 0ms);
	}

	@keyframes petal-fall {
		0% {
			transform: translate3d(0, -4rem, 0) rotate(0deg);
			opacity: 0;
		}
		8% {
			opacity: 0.42;
		}
		85% {
			opacity: 0.28;
		}
		100% {
			transform: translate3d(var(--drift), calc(var(--room-h) + 3rem), 0) rotate(520deg);
			opacity: 0;
		}
	}
	@keyframes orbit-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes halo-pulse {
		0%,
		100% {
			transform: scale(0.96);
			opacity: 0.75;
		}
		50% {
			transform: scale(1.04);
			opacity: 1;
		}
	}
	@keyframes cake-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-0.35rem);
		}
	}
	@keyframes flame-flicker {
		from {
			transform: scaleY(0.92) scaleX(1.02);
			opacity: 0.85;
		}
		to {
			transform: scaleY(1.06) scaleX(0.97);
			opacity: 1;
		}
	}
	@keyframes flame-glow {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 0.85;
		}
	}
	@keyframes smoke-rise {
		0% {
			opacity: 0.7;
			transform: translateY(0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translateY(-1.1rem) scale(1.25);
		}
	}
	@keyframes star-twinkle {
		0%,
		100% {
			opacity: 0.45;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1.08);
		}
	}
	@keyframes draw-underline {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes digit-tick {
		0% {
			opacity: 0.25;
			transform: translateY(-0.28em);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes birthday-sparkle {
		0% {
			opacity: 0;
			transform: translate(0, 30px) scale(0.2);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(var(--x), var(--y)) rotate(var(--turn)) scale(0.65);
		}
	}
	@keyframes feedback-twinkle {
		0% {
			opacity: 0;
			transform: translateY(12px) scale(0.3) rotate(-60deg);
		}
		55% {
			opacity: 1;
			transform: translateY(-6px) scale(1.4) rotate(15deg);
		}
		100% {
			transform: translateY(0) scale(1) rotate(0);
		}
	}
	@keyframes eq-bounce {
		from {
			height: 24%;
		}
		to {
			height: 100%;
		}
	}
	@keyframes fortune-shake {
		0%,
		100% {
			transform: translateX(0) rotate(0);
		}
		20% {
			transform: translateX(-5px) rotate(-1deg);
		}
		45% {
			transform: translateX(4px) rotate(1deg);
		}
		70% {
			transform: translateX(-3px) rotate(-0.5deg);
		}
	}
	@keyframes reveal-rise {
		from {
			opacity: 0;
			transform: translateY(22px);
			filter: blur(4px);
		}
		to {
			opacity: 1;
			transform: none;
			filter: blur(0);
		}
	}
	@keyframes intro-rise {
		from {
			opacity: 0;
			transform: translateY(16px);
			filter: blur(3px);
		}
		to {
			opacity: 1;
			transform: none;
			filter: blur(0);
		}
	}

	@media (min-width: 1280px) {
		.birthday-room {
			max-width: 72rem;
			margin: 0 auto;
		}
	}
	@media (max-width: 1000px) {
		.birthday-hero {
			grid-template-columns: minmax(0, 1fr);
			gap: 1.6rem;
			padding-top: 2.2rem;
		}
		.hero-copy {
			text-align: center;
		}
		.eyebrow {
			justify-content: center;
		}
		.eyebrow-no {
			margin-left: 0;
		}
		.hero-description {
			margin: 0 auto;
		}
		.meta-pills {
			justify-content: center;
		}
		.today-card,
		.countdown-card {
			margin-right: auto;
			margin-left: auto;
			text-align: left;
		}
		.cake-orbit {
			width: min(100%, 26rem);
		}
		.fortune-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.fortune-copy {
			text-align: center;
		}
		.fortune-lead,
		.fortune-quote {
			margin-right: auto;
			margin-left: auto;
		}
		.fortune-stage {
			width: min(100%, 28rem);
			margin: 0 auto;
		}
		.letter-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.letter-side {
			text-align: center;
		}
		.letter-side-lead {
			margin: 0 auto;
		}
		.letter-button {
			margin-top: 1rem;
		}
		.letter-postmark {
			margin-right: auto;
			margin-left: auto;
		}
		.envelope {
			width: min(22rem, 100%);
		}
	}
	@media (max-width: 820px) {
		.wish-options {
			grid-template-columns: minmax(0, 1fr);
		}
		.chapter-head {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.chapter-mark {
			display: none;
		}
	}
	@media (max-width: 620px) {
		.birthday-room {
			padding: 1rem 0.95rem 1.5rem;
			border-radius: var(--radius-large);
		}
		.room-frame {
			inset: 0.35rem;
		}
		.room-topline {
			font-size: 0.64rem;
		}
		.topline-center {
			display: none;
		}
		.room-topline {
			justify-content: space-between;
		}
		.eyebrow-text {
			font-size: 0.56rem;
			letter-spacing: 0.14em;
			white-space: normal;
		}
		.eyebrow-line {
			display: none;
		}
		.hero-copy h1 {
			font-size: clamp(2.7rem, 12.5vw, 3.5rem);
		}
		.hero-today-tip {
			font-size: 0.66rem;
			line-height: 1.9;
		}
		.cake-orbit {
			width: min(100%, 21rem);
		}
		.cake-stage {
			width: 88%;
		}
		.orbit-text {
			display: none;
		}
		.cake-note {
			font-size: 0.95rem;
		}
		.cake-hint {
			font-size: 0.58rem;
		}
		.candle-status {
			min-height: 3.2em;
			font-size: 0.6rem;
		}
		.fortune-stage {
			aspect-ratio: 1.14;
		}
		.fortune-body {
			font-size: 0.95rem;
			line-height: 1.85;
		}
		.fortune-face {
			padding: 1.1rem;
		}
		.letter-paper {
			padding: 1.3rem 1.15rem;
			font-size: 0.84rem;
			line-height: 2;
		}
		.letter-paper::before,
		.letter-postage {
			display: none;
		}
		.letter-sign {
			font-size: 1.3rem;
		}
		.envelope {
			width: min(19rem, 100%);
			height: 12.5rem;
		}
		.send-row {
			flex-direction: column;
			align-items: stretch;
			gap: 0.9rem;
		}
		.send-button {
			width: 100%;
		}
		.wish-feedback {
			min-height: 4.2rem;
		}
		.firework-button {
			margin-left: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.petal {
			display: none;
		}
		.orbit-text,
		.birthday-cake,
		.cake-halo,
		.flame,
		.flame-glow,
		.candle .smoke path,
		.music-eq.playing i,
		.name-underline path,
		.cd-sec,
		.title-star,
		.orbit-spark,
		.wish-sparkles span,
		.feedback-star,
		.intro,
		.reveal.in-view {
			animation: none !important;
		}
		.name-underline path {
			stroke-dashoffset: 0;
		}
		.intro,
		.reveal.in-view {
			opacity: 1;
			transform: none;
			filter: none;
		}
		.envelope,
		.letter-reveal,
		.letter-paper,
		.fortune-inner,
		.wish-card,
		.wish-card::after {
			transition-duration: 0.01ms !important;
		}
		.wish-card:hover {
			transform: none;
		}
		.wish-sparkles {
			display: none;
		}
	}
</style>
