// The live page's six steps (DESIGN.md section 9). Each groups engine stages (story/stages.js) and says in plain
// English what is happening. English only on every run; the trailer rule holds (counts, names the story may show,
// progress; never truths, plan or scene text, judge reasons, costs or model names).
import { HONEST } from "../story/stages.js";

export const STEPS = [
  { n: 1, key: "know", stages: ["arrive", "research"], title: "Getting to know your business",
    body: "We read your website, pick up your brand colours and check where you sell.",
    now: ["Reading your website", "Looking at how you present yourself", "Picking up your colours and logo", "Checking where your customers are"] },
  { n: 2, key: "ideas", stages: ["truths", "concepts"], title: "Finding ideas",
    body: "Our writers look for true things worth saying about your business, and turn each into an opening line.",
    now: ["Studying what we learned about you", "Looking for what makes you different", "Thinking about who buys from you", "Turning angles into opening lines"] },
  { n: 3, key: "pick", stages: ["judge", "pick"], title: "Choosing one idea",
    body: "A panel compares the ideas two at a time, both ways round, so no idea wins by going first.",
    now: ["Comparing ideas side by side", "Swapping the order to keep it fair", "Narrowing down to the top ideas"] },
  { n: 4, key: "plan", stages: ["direction"], title: "Planning the scenes",
    body: "The chosen idea becomes scenes, and every moment gets its timing.",
    now: ["Breaking the idea into scenes", "Timing every moment"] },
  { n: 5, key: "make", stages: ["audio", "visuals"], title: "Voice and pictures",
    body: "Every line is voiced, then each scene gets its own picture, made for this film.",
    now: ["Recording the voice", "Painting each scene", "Matching pictures to the voice", "Adding movement to a few scenes"] },
  { n: 6, key: "cut", stages: ["render"], title: "Cutting your film",
    body: "Pictures, voice and music are cut together, then checked before it reaches you.",
    now: ["Laying pictures on the timeline", "Laying in the music", "Checking the final cut"] },
];
export const DONE = { n: 7, key: "done", title: "Your film is ready", body: HONEST.more };
export const STEP_OF = Object.fromEntries(STEPS.flatMap((s) => s.stages.map((st) => [st, s])));
STEP_OF.done = DONE;
