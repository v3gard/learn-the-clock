import { formatSpokenTime } from './clock'
import type { Language } from './i18n'
import type { Question, QuizState, SentenceSteps } from './quizModel'
import { quizText } from './quizText'

type SentenceChoicesProps = {
  steps: SentenceSteps
  parts: QuizState['parts']
  revealed: boolean
  language: Language
  onPick: (part: 0 | 1, choice: string) => void
}

export function SentenceChoices({ steps, parts, revealed, language, onPick }: SentenceChoicesProps) {
  const text = quizText[language]
  const sentence = parts.some(part => part !== null) ? parts.map(part => part ?? '…').join(' ') : ''
  const preview = sentence ? sentence[0].toUpperCase() + sentence.slice(1) : text.sentencePlaceholder

  return <>
    <p className="sentence-instruction">{text.sentenceIntro}</p>
    <p className="sentence-progress" aria-live="polite" aria-atomic="true">{preview}</p>
    <div className="sentence-selections">
      {([0, 1] as const).map(part => <fieldset className="part-selection" key={part}>
        <legend>{part === 0 ? text.timePhrase : text.hour}</legend>
        <div className="quiz-choices part-choices">
          {steps[part].choices.map(choice => {
            const selected = parts[part] === choice
            const correct = revealed && choice === steps[part].word
            const wrong = revealed && selected && !correct
            return <button type="button" key={choice} aria-disabled={revealed} aria-pressed={selected}
              className={correct ? 'answer-correct' : wrong ? 'answer-wrong' : ''}
              onClick={() => onPick(part, choice)}>
              {choice}
              {(correct || wrong) && <span className="answer-status">
                <span aria-hidden="true">{correct ? '✓' : '✗'}</span> <span className="status-label">{correct ? text.correctPart : text.wrongPart}</span>
              </span>}
            </button>
          })}
        </div>
      </fieldset>)}
    </div>
  </>
}

type TimeChoicesProps = {
  question: Question
  selection: QuizState['selection']
  language: Language
  onAnswer: (choice: number) => void
}

export function TimeChoices({ question, selection, language, onAnswer }: TimeChoicesProps) {
  const text = quizText[language]
  const revealed = selection !== null

  return <div className="quiz-choices">
    {question.choices.map(choice => {
      const correct = revealed && choice === question.time
      const wrong = revealed && selection === choice && !correct
      return <button type="button" key={choice} aria-disabled={revealed}
        className={correct ? 'answer-correct' : wrong ? 'answer-wrong' : ''}
        onClick={() => onAnswer(choice)}>
        {formatSpokenTime(choice, language)}
        {(correct || wrong) && <span className="answer-status">
          {correct ? '✓' : '✗'} {correct ? text.correctLabel : text.wrongLabel}
        </span>}
      </button>
    })}
  </div>
}
