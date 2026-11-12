import { cover, parts, referenceTempo, strings } from './song.mjs';
import { GuitarAudio } from './audio.mjs';

const byId = (id) => document.getElementById(id);
const [
  partsNav, phrasesNav, partMeta, partTitle, partVideo, partLead, neck, positionName,
  techniqueLabel, positionDetail, hearButton, playButton, resetButton, loopInput, speedInput,
  bpmOutput, presets, clickInput, audioInput, status, progress, barsGrid, stepsList, partTip,
  previousButton, nextButton, tuner, videoNotes
] = [
  'parts', 'phrases', 'part-meta', 'part-title', 'part-video', 'part-lead', 'neck', 'position-name',
  'technique', 'position-detail', 'hear', 'play', 'reset', 'loop', 'speed',
  'bpm', 'presets', 'click', 'audio', 'status', 'progress', 'bars', 'steps', 'part-tip',
  'previous', 'next', 'tuner', 'video-notes'
].map(byId);

const audio = new GuitarAudio();
const tempoPresets = [
  { bpm: 60, label: '60' },
  { bpm: 80, label: '80' },
  { bpm: 110, label: '110' },
  { bpm: 145, label: '145' },
  { bpm: referenceTempo, label: 'Как в кавере' }
];
const counts = ['1', 'и', '2', 'и', '3', 'и', '4', 'и'];
const techniqueNames = {
  chord: 'Акцент по форме',
  single: 'Одна струна',
  pm: 'Palm mute',
  hold: 'Без нового удара',
  hammer: 'Hammer-on',
  pull: 'Pull-off',
  dead: 'Глухой удар'
};

let partIndex = 0;
let phraseIndex = 0;
let events = [];
let hitButtons = [];
let phraseButtons = [];
let cursor = 0;
let tempo = 80;
let playing = false;
let playbackRequest = 0;
let nextTime;
let scheduledIndex;
let scheduled = [];
let schedulerTimer;
let frame;

function element(tag, className, value) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (value !== undefined) result.textContent = value;
  return result;
}

function button(label, className, action) {
  const control = element('button', className, label);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
}

function timeLabel(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function videoUrl(seconds) {
  return `${cover}&t=${Math.floor(seconds)}s`;
}

const partButtons = parts.map((part, index) => {
  const control = button(undefined, 'part-button', () => selectPart(index));
  control.append(element('span', '', String(index + 1).padStart(2, '0')),
    element('span', '', part.title), element('time', '', timeLabel(part.time)));
  return control;
});
partsNav.append(...partButtons);

const presetButtons = tempoPresets.map(({ bpm, label }) => button(label, 'chip', () => {
  speedInput.value = bpm;
  changeTempo();
}));
presets.append(...presetButtons);

function buildNeck() {
  neck.append(element('span'), element('span', 'fret-no', '0'));
  for (let fret = 1; fret <= 12; fret += 1) {
    neck.append(element('span', `fret-no ${[3, 5, 7, 9, 12].includes(fret) ? 'mark' : ''}`, fret));
  }
  return strings.map(({ label }, stringIndex) => {
    neck.append(element('span', 'neck-label', label));
    return Array.from({ length: 13 }, (_, fret) => {
      const cell = element('span', fret === 0 ? 'neck-cell open' : 'neck-cell');
      cell.style.setProperty('--weight', `${.75 + stringIndex * .23}px`);
      neck.append(cell);
      return cell;
    });
  });
}

const neckCells = buildNeck();
let markers = [];

function noteDescription(note) {
  if (note.fret === null) return `${note.string}-я приглушена`;
  if (note.fret === 0) return `${note.string}-я открытая`;
  return `${note.string}-я, лад ${note.fret}`;
}

function renderCursor(index) {
  const previous = hitButtons[cursor];
  const shouldMoveFocus = document.activeElement === previous;
  if (previous) {
    previous.removeAttribute('aria-current');
    previous.tabIndex = -1;
  }
  cursor = index;
  hitButtons[cursor].setAttribute('aria-current', 'true');
  hitButtons[cursor].tabIndex = 0;
  if (shouldMoveFocus && !playing) hitButtons[cursor].focus();
  const event = events[cursor];
  positionName.textContent = event.label;
  techniqueLabel.textContent = techniqueNames[event.technique];
  const details = [...event.notes].sort((first, second) => second.string - first.string).map(noteDescription);
  positionDetail.textContent = details.join(' · ');
  neck.setAttribute('aria-label', `${event.label}. ${details.join(', ')}`);
  for (const marker of markers) marker.remove();
  markers = event.notes.map(({ string, fret, finger }) => {
    const modifier = fret === null ? 'muted-note' : fret === 0 ? 'open-note' : '';
    const marker = element('span', `finger ${modifier}`, fret === null ? '×' : fret === 0 ? '0' : finger);
    neckCells[string - 1][fret ?? 0].append(marker);
    return marker;
  });
  progress.textContent = `Такт ${Math.floor(index / 8) + 1} из ${events.length / 8} · ${index % 8 + 1}/8`;
  hearButton.disabled = event.technique === 'hold';
}

function tabValue(event, string) {
  if (event.technique === 'hold') return '';
  const note = event.notes.find((entry) => entry.string === string);
  if (!note) return '';
  if (event.technique === 'hammer') return `h${note.fret}`;
  if (event.technique === 'pull') return `p${note.fret}`;
  return note.fret === null ? '×' : String(note.fret);
}

function buildBar(bar, barIndex) {
  const root = element('div', 'bar');
  const title = element('div', 'bar-title', `${barIndex + 1}. ${bar.name}`);
  const grid = element('div', 'tab-grid');
  const labels = element('div', 'tab-labels');
  labels.setAttribute('aria-hidden', 'true');
  labels.append(element('span'), ...strings.map(({ label }) => element('span', '', label)), element('span'));
  grid.append(labels);
  bar.events.forEach((event, offset) => {
    const index = barIndex * 8 + offset;
    const control = button(undefined, 'hit', () => seek(index));
    control.tabIndex = -1;
    const notation = strings.map(({ number }) => tabValue(event, number));
    control.setAttribute('aria-label',
      `Такт ${barIndex + 1}, восьмая ${offset + 1}. ${techniqueNames[event.technique]}. ${event.notes.map(noteDescription).join(', ')}`);
    control.append(element('span', offset === 0 ? 'count accent' : 'count', counts[offset]),
      ...notation.map((value) => element('span', value ? '' : 'empty', value)),
      element('span', 'pm', event.technique === 'pm' ? 'PM' : event.technique === 'hold' ? '·' : ''));
    grid.append(control);
    hitButtons.push(control);
  });
  root.append(title, grid);
  return root;
}

function allBars(part) {
  // The standalone bridge riff is already included in its two full passes.
  return part.phrases.slice(part.videoNotes ? 1 : 0).flatMap(({ bars }) => bars);
}

function selectPhrase(index) {
  stopPlayback();
  phraseIndex = index;
  const part = parts[partIndex];
  const bars = index === part.phrases.length ? allBars(part) : part.phrases[index].bars;
  events = bars.flatMap((bar) => bar.events);
  phraseButtons.forEach((control, controlIndex) => control.setAttribute('aria-pressed', controlIndex === phraseIndex));
  hitButtons = [];
  barsGrid.replaceChildren(...bars.map(buildBar));
  renderCursor(0);
}

function selectPart(index, goToLesson = false) {
  partIndex = index;
  const part = parts[index];
  partButtons.forEach((control, controlIndex) => {
    if (controlIndex === index) control.setAttribute('aria-current', 'true');
    else control.removeAttribute('aria-current');
  });
  partMeta.textContent = `Часть ${index + 1} из ${parts.length}`;
  partTitle.textContent = part.title;
  partVideo.textContent = `Кавер ${timeLabel(part.time)} ↗`;
  partVideo.href = videoUrl(part.time);
  partLead.textContent = part.lead;
  stepsList.replaceChildren(...part.steps.map((step) => element('li', '', step)));
  partTip.textContent = part.tip;
  videoNotes.replaceChildren(...(part.videoNotes ?? []).map(({ time, label }) => {
    const link = element('a', 'text-link', `${timeLabel(time)} · ${label} ↗`);
    link.href = videoUrl(time);
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }));
  videoNotes.hidden = !part.videoNotes;
  const phraseLabels = [...part.phrases.map(({ name }) => name), 'Вся часть'];
  phraseButtons = phraseLabels.map((label, controlIndex) => button(label, 'chip', () => selectPhrase(controlIndex)));
  phrasesNav.replaceChildren(...phraseButtons);
  previousButton.disabled = index === 0;
  nextButton.disabled = index === parts.length - 1;
  selectPhrase(0);
  const navPosition = partsNav.scrollLeft;
  const activeButton = partButtons[index];
  if (partsNav.scrollWidth > partsNav.clientWidth) {
    if (activeButton.offsetLeft - partsNav.offsetLeft < navPosition ||
        activeButton.offsetLeft - partsNav.offsetLeft + activeButton.offsetWidth > navPosition + partsNav.clientWidth) {
      partsNav.scrollLeft = activeButton.offsetLeft - partsNav.offsetLeft - 4;
    }
  }
  if (goToLesson) {
    partTitle.tabIndex = -1;
    partTitle.focus({ preventScroll: true });
    byId('practice').scrollIntoView();
  }
}

function stepLength() {
  return 30 / tempo;
}

function noteLength(index) {
  let next = index + 1;
  while (events[next]?.technique === 'hold') next += 1;
  return (next - index) * stepLength() * .99;
}

function showAudioError() {
  status.hidden = false;
  status.textContent = 'Звук не запустился. Нажми кнопку ещё раз или открой урок в другом браузере.';
}

function updateTransport() {
  playButton.textContent = playing ? 'Ⅱ Пауза' : '▶ Играть';
}

function stopPlayback() {
  playbackRequest += 1;
  playing = false;
  clearInterval(schedulerTimer);
  cancelAnimationFrame(frame);
  audio.stopPlayback();
  scheduled = [];
  updateTransport();
}

function schedule() {
  if (nextTime < audio.time - .2 && scheduledIndex < events.length) nextTime = audio.time + .035;
  const horizon = audio.time + .105;
  while (nextTime < horizon) {
    if (scheduledIndex === events.length) {
      if (loopInput.checked) scheduledIndex = 0;
      else break;
    }
    const event = events[scheduledIndex];
    if (clickInput.checked && scheduledIndex % 2 === 0) audio.tick(nextTime, scheduledIndex % 8 === 0);
    if (audioInput.checked) audio.strike(event, nextTime, noteLength(scheduledIndex), scheduledIndex % 2 === 1);
    scheduled.push({ index: scheduledIndex, time: nextTime });
    nextTime += stepLength();
    scheduledIndex += 1;
  }
}

function animate() {
  let visible;
  while (scheduled.length && scheduled[0].time <= audio.time) visible = scheduled.shift();
  if (visible && visible.index !== cursor) renderCursor(visible.index);
  if (scheduledIndex === events.length && !loopInput.checked && audio.time >= nextTime && !scheduled.length) {
    stopPlayback();
    return;
  }
  frame = requestAnimationFrame(animate);
}

async function startPlayback(from = cursor) {
  const request = ++playbackRequest;
  status.hidden = true;
  try {
    await audio.open();
    if (request !== playbackRequest) return;
    if (audioInput.checked) audio.prepare(events);
    scheduled = [];
    scheduledIndex = from;
    nextTime = audio.time + .075;
    audio.startPlayback();
    playing = true;
    updateTransport();
    schedule();
    schedulerTimer = window.setInterval(schedule, 25);
    frame = requestAnimationFrame(animate);
  } catch {
    if (request === playbackRequest) {
      stopPlayback();
      showAudioError();
    }
  }
}

function seek(index) {
  const wasPlaying = playing;
  stopPlayback();
  renderCursor(index);
  if (wasPlaying) void startPlayback(index);
}

function changeTempo() {
  const nextTempo = Number(speedInput.value);
  if (nextTempo !== tempo) {
    tempo = nextTempo;
    if (playing) seek(cursor);
  }
  bpmOutput.textContent = `${tempo} BPM`;
  presetButtons.forEach((control, index) => control.setAttribute('aria-pressed', tempoPresets[index].bpm === tempo));
}

async function preview(action, reportError) {
  try {
    await audio.open();
    status.hidden = true;
    action();
  } catch {
    reportError();
  }
}

playButton.addEventListener('click', () => {
  if (playing) stopPlayback();
  else void startPlayback(!loopInput.checked && cursor === events.length - 1 ? 0 : cursor);
});
resetButton.addEventListener('click', () => seek(0));
barsGrid.addEventListener('keydown', (event) => {
  if (!event.target.closest('.hit')) return;
  const focused = hitButtons.indexOf(event.target);
  const targets = { ArrowLeft: focused - 1, ArrowRight: focused + 1, Home: 0, End: events.length - 1 };
  if (!(event.key in targets)) return;
  event.preventDefault();
  const target = Math.max(0, Math.min(events.length - 1, targets[event.key]));
  seek(target);
  hitButtons[target].focus();
});
speedInput.addEventListener('input', changeTempo);
hearButton.addEventListener('click', () => {
  const event = events[cursor];
  const length = event.technique === 'pm' ? .2 : .75;
  void preview(() => audio.strike(event, audio.time + .03, length, false, true), showAudioError);
});
previousButton.addEventListener('click', () => selectPart(partIndex - 1, true));
nextButton.addEventListener('click', () => selectPart(partIndex + 1, true));

const tunerStatus = element('p', 'status');
tunerStatus.setAttribute('role', 'status');
tunerStatus.hidden = true;
tuner.after(tunerStatus);
[...strings].reverse().forEach(({ number, label, midi }) => {
  const control = button(`${number} ${label}`, 'chip', () => {
    tunerStatus.hidden = true;
    void preview(() => audio.tuningNote(midi), () => {
      tunerStatus.hidden = false;
      tunerStatus.textContent = 'Звук струны не запустился. Попробуй ещё раз.';
    });
  });
  control.setAttribute('aria-label', `Послушать открытую струну ${number}, ${label}`);
  tuner.append(control);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPlayback();
});
changeTempo();
selectPart(0);
