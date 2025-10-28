// 初始化变量
let currentSongIndex = 0;
let songs = [];
let currentLrcData = {};
const audio = document.getElementById('audio');
const progressBar = document.querySelector('.progress-bar');
const playBtn = document.querySelector('.playbtn');
const prevBtn = document.querySelector('.last');
const nextBtn = document.querySelector('.next');
const randomBtn = document.querySelector('.randombtn');
const playlistBtn = document.querySelector('.playlistbtn');
const repeatBtn = document.querySelector('.isrepeat');
const playlistElement = document.querySelector('.playlist ul');
const playerElement = document.querySelector('.player');

// 初始化播放器
async function initPlayer() {
  try {
    // 从songs.json加载歌曲数据
    const response = await fetch('songs.json');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    songs = data.songs || [];
    
    if (songs.length === 0) {
      console.warn("歌曲列表为空，请检查songs.json文件");
      return;
    }
    
    buildPlaylist();
    loadSong(currentSongIndex);
    setupAudioEvents();
    
  } catch (error) {
    console.error("加载歌曲数据失败:", error);
    songs = [];
    document.getElementById('title').textContent = "加载歌曲失败";
    document.getElementById('singer').textContent = "请检查网络连接";
  }
}

// 解析LRC文件内容
function parseLRC(lrcText) {
  const lines = lrcText.split('\n');
  const lrcData = {};
  
  lines.forEach(line => {
    line = line.trim();
    // 匹配时间标签 [mm:ss.xx] 或 [mm:ss]
    const timeMatches = line.match(/\[(\d+):(\d+)(\.\d+)?\]/g);
    
    if (timeMatches) {
      const text = line.replace(timeMatches.join(''), '').trim();
      
      timeMatches.forEach(timeTag => {
        const timeMatch = timeTag.match(/\[(\d+):(\d+)(\.\d+)?\]/);
        if (timeMatch) {
          const minutes = parseFloat(timeMatch[1]);
          const seconds = parseFloat(timeMatch[2]);
          const milliseconds = timeMatch[3] ? parseFloat(timeMatch[3]) : 0;
          const totalTime = (minutes * 60 + seconds + milliseconds).toFixed(3);
          
          if (text) {
            lrcData[totalTime] = text;
          }
        }
      });
    }
  });
  
  return lrcData;
}

// 加载LRC文件
async function loadLRC(lrcPath) {
  try {
    const response = await fetch(lrcPath);
    if (!response.ok) {
      throw new Error(`LRC文件加载失败: ${response.status}`);
    }
    const lrcText = await response.text();
    currentLrcData = parseLRC(lrcText);
  } catch (error) {
    console.error("加载LRC文件失败:", error);
    currentLrcData = {};
  }
}

// 加载歌曲
async function loadSong(index) {
  if (index < 0 || index >= songs.length) return;
  
  currentSongIndex = index;
  const song = songs[index];
  
  // 更新UI
  updateSongInfo(song);
  updateActiveSongInPlaylist(index);
  
  // 加载LRC文件
  await loadLRC(song.lrc);
  
  // 设置音频源
  audio.src = song.url;
  audio.load();
  
  // 初始化duration防止NaN
  progressBar.max = 100;
  updateTimeDisplay();
  
  // 尝试自动播放
  const playPromise = audio.play();
  
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.log("自动播放被阻止:", error);
      playerElement.classList.remove('play');
    });
  }
}

// 更新歌曲信息
function updateSongInfo(song) {
  document.getElementById('title').textContent = song.name;
  document.getElementById('singer').textContent = song.artist;
  document.getElementById('album_name').textContent = song.album;
  
  const albumImg = document.getElementById('album_img');
  const bgImg = document.getElementById('bg_img');
  
  albumImg.src = bgImg.src = song.img;
  albumImg.onload = bgImg.onload = function() {
    this.style.opacity = 1;
  };
}

// 构建播放列表
function buildPlaylist() {
  playlistElement.innerHTML = '';
  
  songs.forEach((song, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${song.name} - ${song.artist}`;
    li.addEventListener('click', () => {
      loadSong(index);
      togglePlaylist();
    });
    playlistElement.appendChild(li);
  });
}

// 更新播放列表中的当前歌曲
function updateActiveSongInPlaylist(index) {
  const items = playlistElement.querySelectorAll('li');
  items.forEach((item, i) => {
    item.classList.toggle('act', i === index);
  });
}

// 设置音频事件监听
function setupAudioEvents() {
  // 播放/暂停事件
  audio.addEventListener('play', () => {
    playerElement.classList.add('play');
    playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/></svg>';
  });
  
  audio.addEventListener('pause', () => {
    playerElement.classList.remove('play');
    playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>';
  });
  
  // 进度更新
  audio.addEventListener('timeupdate', updateProgress);
  
  // 歌曲结束
  audio.addEventListener('ended', () => {
    if (repeatBtn.classList.contains('act')) {
      audio.currentTime = 0;
      audio.play();
    } else {
      playNext();
    }
  });
  
  // 元数据加载
  audio.addEventListener('loadedmetadata', () => {
    progressBar.max = audio.duration || 100;
    updateTimeDisplay();
  });
  
  // 错误处理
  audio.addEventListener('error', (e) => {
    console.error("音频加载错误:", e);
    updateTimeDisplay(); // 确保时间显示正常
  });
}

// 更新进度条
function updateProgress() {
  progressBar.value = audio.currentTime;
  updateTimeDisplay();
  updateLyrics();
}

// 更新时间显示 - 增加容错处理
function updateTimeDisplay() {
  let currentTime = "00:00";
  let duration = "00:00";
  
  try {
    currentTime = formatTime(isNaN(audio.currentTime) ? 0 : audio.currentTime);
    duration = formatTime(isNaN(audio.duration) ? 0 : audio.duration);
  } catch (e) {
    console.log("时间显示错误:", e);
  }
  
  document.querySelector('.time').textContent = `${currentTime}/${duration}`;
}

// 更新歌词
function updateLyrics() {
  const currentTime = audio.currentTime;
  let currentLrc = "";
  
  for (const time in currentLrcData) {
    if (parseFloat(time) <= currentTime) {
      currentLrc = currentLrcData[time];
    }
  }
  
  document.querySelector('.lrc').textContent = currentLrc;
}

// 格式化时间
function formatTime(seconds) {
  seconds = Math.floor(seconds || 0);
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 播放下一首
function playNext() {
  currentSongIndex = (currentSongIndex + 1) % songs.length;
  loadSong(currentSongIndex);
}

// 播放上一首
function playPrev() {
  currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
  loadSong(currentSongIndex);
}

// 切换播放列表显示
function togglePlaylist() {
  playlistElement.parentElement.style.display = 
    playlistElement.parentElement.style.display === 'block' ? 'none' : 'block';
}

// 进度条触摸事件处理
function handleTouchProgress(e) {
  e.preventDefault();
  const rect = this.getBoundingClientRect();
  const pos = (e.touches[0].clientX - rect.left) / rect.width;
  const newTime = pos * progressBar.max;
  
  progressBar.value = newTime;
  audio.currentTime = newTime;
  
  // 立即更新时间显示
  updateTimeDisplay();
}

// 事件监听
playBtn.addEventListener('click', () => {
  audio.paused ? audio.play() : audio.pause();
});

prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);

randomBtn.addEventListener('click', () => {
  const randomIndex = Math.floor(Math.random() * songs.length);
  loadSong(randomIndex);
});

playlistBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePlaylist();
});

repeatBtn.addEventListener('click', function() {
  this.classList.toggle('act');
});

// 进度条事件 - 增加触摸支持
progressBar.addEventListener('input', () => {
  audio.currentTime = progressBar.value;
});

progressBar.addEventListener('touchstart', handleTouchProgress);
progressBar.addEventListener('touchmove', handleTouchProgress);

document.addEventListener('click', (e) => {
  if (!playlistElement.parentElement.contains(e.target) && 
      e.target !== playlistBtn && 
      !playlistBtn.contains(e.target)) {
    playlistElement.parentElement.style.display = 'none';
  }
});

// 初始化播放器
initPlayer();