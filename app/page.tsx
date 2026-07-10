"use client";

/* eslint-disable @next/next/no-img-element */
import { FormEvent, useEffect, useRef, useState } from "react";

import MemoryWalk from "./memory-walk/MemoryWalk";

type Memory = {
  id: string;
  title: string;
  place: string;
  date: string;
  note: string;
  image: string;
  palette: string;
};

type Track = {
  title: string;
  artist: string;
  src: string;
};

const PASSCODES = ["shade50", "shadé50", "50months"];

const birthdayLetter = [
  "My love, happy birthday.",
  "By the time this day arrives, we will have loved each other through fifty months of ordinary days, impossible days, silly days, and the kind of days I wish I could bottle forever.",
  "I made this little world because I wanted you to have a place that feels like us: warm, playful, full of memories, and completely yours. Every stop is one more way of saying that I see you, I choose you, and I am so grateful I get to love you.",
  "You are my favorite person, my safest place, and the future I keep reaching for. If I could give you the world, I would start here.",
  "I love you endlessly.",
];

const loveReasons = [
  "You make ordinary days feel like something I want to remember.",
  "Your laugh feels like home to me.",
  "You make me want to become softer, braver, and better.",
  "You have a way of making the world feel less heavy.",
  "I love the way your joy fills a room.",
  "You understand parts of me I do not always know how to explain.",
  "You are gentle in ways that stay with me.",
  "You make love feel playful, safe, and real.",
  "I love how deeply you care.",
  "You are my favorite person to miss and my favorite person to come back to.",
  "Your smile can change the whole shape of my day.",
  "You make the future feel warm instead of scary.",
  "I love how we can be silly together.",
  "You are beautiful in the loud moments and the quiet ones.",
  "You make me feel chosen.",
  "I love the little things you remember.",
  "Being loved by you feels like sunlight.",
  "I love how your presence calms me.",
  "You make every memory brighter just by being in it.",
  "I love the way you dream.",
  "You are kind in ways that make me proud to know you.",
  "I love hearing your voice.",
  "You make me laugh when I need it most.",
  "You are my safest place.",
  "I love how we have our own tiny language.",
  "You make distance feel worth enduring.",
  "I love the way you look at the world.",
  "You make me believe in forever one day at a time.",
  "I love your heart.",
  "You are the person I want beside me in every version of life.",
  "I love how naturally you became part of my prayers and plans.",
  "You make me feel lucky in the deepest way.",
  "I love your softness.",
  "I love your strength.",
  "You make the smallest moments feel sacred.",
  "I love the way you care about the people you love.",
  "You are my favorite hello.",
  "You are the hardest goodbye.",
  "I love that we keep choosing each other.",
  "You make love feel like a place I can live in.",
  "I love your patience with me.",
  "You make my heart feel known.",
  "I love how beautiful your mind is.",
  "I love how we can grow together.",
  "You make me want to give you every good thing I can.",
  "I love the tenderness we have built.",
  "You are magic in the most human way.",
  "I love that my favorite memories all seem to lead back to you.",
  "You are my little universe.",
  "Because after fifty months, I still know I would choose you again.",
];

function buildNameFormation() {
  return [
    { x: 12, y: 30 }, { x: 16, y: 30 }, { x: 20, y: 30 },
    { x: 12, y: 42 }, { x: 16, y: 50 }, { x: 20, y: 58 },
    { x: 12, y: 70 }, { x: 16, y: 70 }, { x: 20, y: 70 },
    { x: 27, y: 30 }, { x: 27, y: 42 }, { x: 27, y: 54 },
    { x: 35, y: 54 }, { x: 35, y: 42 }, { x: 35, y: 30 },
    { x: 27, y: 70 }, { x: 35, y: 70 },
    { x: 42, y: 70 }, { x: 45, y: 54 }, { x: 48, y: 38 },
    { x: 51, y: 54 }, { x: 54, y: 70 }, { x: 45, y: 56 },
    { x: 51, y: 56 },
    { x: 60, y: 30 }, { x: 60, y: 42 }, { x: 60, y: 54 },
    { x: 60, y: 66 }, { x: 64, y: 30 }, { x: 68, y: 34 },
    { x: 70, y: 44 }, { x: 70, y: 56 }, { x: 68, y: 66 },
    { x: 64, y: 70 },
    { x: 77, y: 30 }, { x: 81, y: 30 }, { x: 85, y: 30 },
    { x: 77, y: 42 }, { x: 77, y: 54 }, { x: 81, y: 54 },
    { x: 85, y: 54 }, { x: 77, y: 66 }, { x: 77, y: 70 },
    { x: 81, y: 70 }, { x: 85, y: 70 },
    { x: 80, y: 21 }, { x: 82.5, y: 18 }, { x: 85, y: 15 },
    { x: 88, y: 30 }, { x: 88, y: 70 },
  ];
}

function buildHeartFormation() {
  return loveReasons.map((_, index) => {
    const angle = (Math.PI * 2 * index) / loveReasons.length;
    const x = 16 * Math.sin(angle) ** 3;
    const y =
      13 * Math.cos(angle) -
      5 * Math.cos(2 * angle) -
      2 * Math.cos(3 * angle) -
      Math.cos(4 * angle);

    return {
      x: 50 + x * 1.95,
      y: 55 - y * 2.12,
    };
  });
}

const nameFormation = buildNameFormation();
const heartFormation = buildHeartFormation();

const fireflies = loveReasons.map((reason, index) => ({
  id: index + 1,
  reason,
  left: 7 + ((index * 19) % 86),
  top: 8 + ((index * 31) % 84),
  nameLeft: nameFormation[index].x,
  nameTop: nameFormation[index].y,
  heartLeft: heartFormation[index].x,
  heartTop: heartFormation[index].y,
  delay: -((index * 0.37) % 6),
  drift: 24 + ((index * 7) % 38),
}));

const starQuote =
  "Of all the stars I could have wished on, I am most grateful for the one that led me to you.";

const memories: Memory[] = [
  {
    id: "senior-sunset",
    title: "Senior Sunset",
    place: "The park swing",
    date: "Where this story opens",
    note:
      "A warm sky, a swing, your hand in mine, and one of those moments that still feels golden when I think about it.",
    image: "/photos/senior-sunset.jpg",
    palette: "rose",
  },
  {
    id: "first-adventure",
    title: "First Adventure",
    place: "Our little beginning",
    date: "Memory chapter 2",
    note:
      "The kind of day where everything felt new, and somehow still felt like we had been finding our way to each other forever.",
    image: "/photos/first-adventure.jpg",
    palette: "gold",
  },
  {
    id: "favorite-laugh",
    title: "That Laugh",
    place: "Somewhere only we understand",
    date: "Memory chapter 3",
    note:
      "One of my favorite sounds in the world is you laughing at something we both know is ridiculous.",
    image: "/photos/favorite-laugh.jpg",
    palette: "teal",
  },
  {
    id: "quiet-day",
    title: "A Quiet Day",
    place: "The soft middle of us",
    date: "Memory chapter 4",
    note:
      "Not every perfect memory is loud. Some are just us existing near each other and making the world feel gentle.",
    image: "/photos/quiet-day.jpg",
    palette: "violet",
  },
  {
    id: "big-dreams",
    title: "Big Dreams",
    place: "Talking about forever",
    date: "Memory chapter 5",
    note:
      "I love the way our future sounds when we talk about it together, like something bright we are building one day at a time.",
    image: "/photos/big-dreams.jpg",
    palette: "blue",
  },
  {
    id: "fifty-months",
    title: "Fifty Months",
    place: "Still choosing you",
    date: "Birthday chapter",
    note:
      "Fifty months of loving you, learning you, missing you, laughing with you, and knowing I would choose you again.",
    image: "/photos/fifty-months.jpg",
    palette: "peach",
  },
];

const memoryWalkMemories = memories.map(({ id, title }) => ({ id, title }));

const tracks: Track[] = [
  {
    title: "Honeybee temp",
    artist: "Olivia Rodrigo until your cover is ready",
    src: "/audio/honeybeeOriginal.mp3",
  },
  {
    title: "Paris in the Rain",
    artist: "Lauv",
    src: "/audio/parisInTheRain.mp3",
  },
  {
    title: "Adorn",
    artist: "Miguel",
    src: "/audio/adorn.mp3",
  },
];

const fallingSprites = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  type: index % 4 === 0 ? "cookie" : "heart",
}));
const gateParticles = Array.from({ length: 26 }, (_, index) => index);

export default function Home() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [letterOpen, setLetterOpen] = useState(false);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  const [selectedReason, setSelectedReason] = useState(loveReasons[0]);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [foundFireflies, setFoundFireflies] = useState<number[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pathReachedNight, setPathReachedNight] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioStatus, setAudioStatus] = useState("Waiting for your first click.");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reasonTimeoutRef = useRef<number | null>(null);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = passcode.trim().toLowerCase();

    if (PASSCODES.includes(normalized)) {
      const audio = audioRef.current;

      if (audio) {
        audio.volume = 0.72;
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            setAudioStatus("Playing.");
          })
          .catch(() => {
            setIsPlaying(false);
            setAudioStatus("Tap Play when you are ready.");
          });
      }

      setIsUnlocked(true);
      setPasscodeError("");
      return;
    }

    setPasscodeError("Not quite. Try the one made for her.");
  }

  function toggleAudio() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setAudioStatus("Paused.");
      return;
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setAudioStatus("Playing.");
      })
      .catch(() => {
        setIsPlaying(false);
        setAudioStatus("Add the audio file to unlock this track.");
      });
  }

  function changeTrack(nextIndex: number) {
    setTrackIndex(nextIndex);
    setIsPlaying(false);
    setAudioStatus("Ready.");
  }

  function revealReason(id: number, reason: string) {
    setFoundFireflies((current) => (
      current.includes(id) ? current : [...current, id]
    ));
    setSelectedReason(reason);
    setReasonVisible(true);

    if (reasonTimeoutRef.current) {
      window.clearTimeout(reasonTimeoutRef.current);
    }

    reasonTimeoutRef.current = window.setTimeout(() => {
      setReasonVisible(false);
      reasonTimeoutRef.current = null;
    }, 4200);
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.load();
  }, [trackIndex]);

  useEffect(() => {
    return () => {
      if (reasonTimeoutRef.current) {
        window.clearTimeout(reasonTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function closeOpenDialog(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (activeMemory) {
        setActiveMemory(null);
      } else if (letterOpen) {
        setLetterOpen(false);
      }
    }

    window.addEventListener("keydown", closeOpenDialog);
    return () => window.removeEventListener("keydown", closeOpenDialog);
  }, [activeMemory, letterOpen]);

  return (
    <>
      <audio
        ref={audioRef}
        src={tracks[trackIndex].src}
        preload="auto"
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setAudioStatus("Add the audio file to unlock this track.");
        }}
      />

      {!isUnlocked ? (
      <main className="gate-screen">
        <div className="gate-aurora" aria-hidden="true" />
        <div className="gate-particles" aria-hidden="true">
          {gateParticles.map((particle) => (
            <span key={particle} />
          ))}
        </div>
        <section className="gate-panel" aria-labelledby="gate-title">
          <div className="gate-kicker">For Shadé</div>
          <h1 id="gate-title">A little world for your birthday</h1>
          <p>
            Fifty months of us, tucked behind one tiny secret. Enter the
            passcode to begin.
          </p>
          <form onSubmit={unlock} className="passcode-form">
            <label htmlFor="passcode">Passcode</label>
            <div className="passcode-row">
              <input
                id="passcode"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit">Enter</button>
            </div>
            {passcodeError ? (
              <p className="form-error" role="alert">
                {passcodeError}
              </p>
            ) : null}
          </form>
        </section>
      </main>
      ) : (
    <main className="birthday-site">
      <div className="heartfall" aria-hidden="true">
        {fallingSprites.map((sprite) => (
          <span className={sprite.type} key={sprite.id} />
        ))}
      </div>

      <section className="hero" aria-labelledby="hero-title">
        <img
          className="hero-art"
          src="/assets/senior-sunset-swing.png"
          alt="Pixel art of two sweethearts holding hands on a park swing at sunset."
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <h1 id="hero-title">Happy birthday my Shadé</h1>
          <p>
            In every lifetime, in every little world, my heart would still find
            its way back to you.
          </p>
        </div>
        <button
          className="floating-letter"
          onClick={() => setLetterOpen(true)}
          aria-label="Open birthday letter"
        >
          <span />
        </button>
      </section>

      <section className="music-dock" aria-label="Music player">
        <div>
          <p className="dock-label">Now cued</p>
          <h2>{tracks[trackIndex].title}</h2>
          <p>
            {tracks[trackIndex].artist} · {audioStatus}
          </p>
        </div>
        <div className="track-buttons" aria-label="Choose a song">
          {tracks.map((track, index) => (
            <button
              className={index === trackIndex ? "selected" : ""}
              key={track.title}
              onClick={() => changeTrack(index)}
              type="button"
            >
              {index + 1}
            </button>
          ))}
        </div>
        <button className="play-button" onClick={toggleAudio} type="button">
          {isPlaying ? "Pause" : "Play"}
        </button>
      </section>

      <section
        className={`world-section ${pathReachedNight ? "has-reached-night" : ""}`}
        aria-labelledby="world-title"
      >
        <div className="section-heading">
          <p className="eyebrow">The memory path</p>
          <h2 id="world-title">A little park built from our favorite days</h2>
          <p>
            Walk with the sunset at your back. Every glowing board holds a
            little piece of us.
          </p>
        </div>

        <MemoryWalk
          memories={memoryWalkMemories}
          onOpenMemory={(memoryId) => {
            const memory = memories.find((item) => item.id === memoryId);
            if (memory) {
              setActiveMemory(memory);
            }
          }}
          onProgressChange={(progress) => {
            if (progress >= 0.92) {
              setPathReachedNight(true);
            }
          }}
          paused={Boolean(activeMemory || letterOpen)}
          reducedMotion={reducedMotion}
        />
        <p className="scroll-cue">
          {pathReachedNight
            ? "The night found us. The fireflies are waiting below."
            : "The sun keeps setting as the path carries you to the right."}
        </p>
      </section>

      <section className="twilight-bridge" aria-label="Twilight transition">
        <div className="firefly-field" aria-label="Fifty reasons I love you">
          {fireflies.map((firefly) => (
            <button
              className={`love-firefly ${
                foundFireflies.includes(firefly.id) ? "is-found" : ""
              }`}
              key={firefly.id}
              onClick={() => revealReason(firefly.id, firefly.reason)}
              style={
                {
                  "--firefly-left": `${firefly.left}%`,
                  "--firefly-top": `${firefly.top}%`,
                  "--name-left": `${firefly.nameLeft}%`,
                  "--name-top": `${firefly.nameTop}%`,
                  "--heart-left": `${firefly.heartLeft}%`,
                  "--heart-top": `${firefly.heartTop}%`,
                  "--firefly-delay": `${firefly.delay}s`,
                  "--firefly-drift": `${firefly.drift}px`,
                } as React.CSSProperties
              }
              type="button"
              aria-label={`Reason ${firefly.id}: ${firefly.reason}${
                foundFireflies.includes(firefly.id) ? " Already found." : ""
              }`}
            />
          ))}
        </div>
        <div className="bridge-copy">
          <p>
            And after every golden memory, I would still choose the quiet of the
            night beside you.
          </p>
          <div
            className={`reason-card ${reasonVisible ? "is-visible" : ""}`}
            aria-live="polite"
          >
            <span>One little light says</span>
            <strong>{selectedReason}</strong>
          </div>
        </div>
      </section>

      <section className="star-finale" aria-labelledby="star-title">
        <div className="star-finale-art" aria-hidden="true" />
        <div className="star-copy">
          <p className="eyebrow">Under every sky</p>
          <h2 id="star-title">
            {starQuote.split(" ").map((word, index) => (
              <span className="star-word" key={`${word}-${index}`}>
                {word}
              </span>
            ))}
          </h2>
          <p>
            We have built a constellation of memories Shadé, but I want the rest of the
            sky with you.
          </p>
        </div>
      </section>

      {letterOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="letter-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="letter-title"
          >
            <button
              className="close-button"
              onClick={() => setLetterOpen(false)}
              aria-label="Close letter"
              type="button"
              autoFocus
            >
              ×
            </button>
            <p className="eyebrow">A letter for you</p>
            <h2 id="letter-title">My favorite person</h2>
            {birthdayLetter.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        </div>
      ) : null}

      {activeMemory ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="memory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-title"
          >
            <button
              className="close-button"
              onClick={() => setActiveMemory(null)}
              aria-label="Close memory"
              type="button"
              autoFocus
            >
              ×
            </button>
            <div className={`memory-photo ${activeMemory.palette}`}>
              <img
                src={activeMemory.image}
                alt={`${activeMemory.title} memory photo placeholder`}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <span>Drop photo here</span>
            </div>
            <div className="memory-copy">
              <p className="eyebrow">{activeMemory.date}</p>
              <h2 id="memory-title">{activeMemory.title}</h2>
              <p className="place">{activeMemory.place}</p>
              <p>{activeMemory.note}</p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
      )}
    </>
  );
}
