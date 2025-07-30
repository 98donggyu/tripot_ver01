# app/services/quiz_manager.py

import json
import random
import pandas as pd
import uuid
import asyncio

# 이 파일은 이제 DB에 직접 접근하지 않으므로, sqlalchemy 관련 임포트는 제거합니다.

class QuizManager:
    """
    퀴즈의 논리와 상태를 관리합니다. (DB 접근 로직 제거)
    """
    def __init__(self, quizzes_df: pd.DataFrame, prompts_file_path: str, llm_module=None):
        self.all_quizzes = quizzes_df
        self.quiz_prompts = self._load_prompts(prompts_file_path)
        self.llm_module = llm_module

        # 퀴즈 상태 변수들
        self.is_quiz_active = False
        self.current_quizzes = []
        self.current_quiz_index = 0
        self.correct_answers_count = 0
        self.current_quiz_session_id = None
        self.user_id = None

        if self.llm_module is None:
            print("⚠️ 경고: QuizManager에 LLM 모듈이 제공되지 않았습니다.")

    def _load_prompts(self, prompts_file_path: str) -> dict:
        """프롬프트 JSON 파일을 로드합니다."""
        try:
            with open(prompts_file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ 퀴즈 프롬프트 파일 로드 오류 ('{prompts_file_path}'): {e}")
            return {}

    def start_quiz(self, user_id: str, num_quizzes: int = 1) -> tuple[str, str | None]:
        """퀴즈를 시작하고 (시작 메시지, 첫 문제)를 반환합니다."""
        if self.all_quizzes.empty:
            return "죄송해요, 아직 퀴즈가 준비되지 않았어요.", None

        self.is_quiz_active = True
        self.current_quiz_index = 0
        self.correct_answers_count = 0
        self.user_id = user_id
        self.current_quiz_session_id = str(uuid.uuid4())

        num_to_sample = min(num_quizzes, len(self.all_quizzes))
        self.current_quizzes = self.all_quizzes.sample(n=num_to_sample).to_dict(orient='records')
        
        start_msg = random.choice(self.quiz_prompts.get('quiz_start_prompts', ["퀴즈 시작!"]))
        start_msg = start_msg.format(num_quizzes=len(self.current_quizzes))
        
        first_question = self._get_current_question_text()
        return start_msg, first_question

    def _get_current_question_text(self) -> str | None:
        """현재 문제의 텍스트를 포맷에 맞게 반환합니다."""
        if not self.is_quiz_active:
            return None
        
        current_quiz = self.current_quizzes[self.current_quiz_index]
        template = self.quiz_prompts.get('quiz_question_template', "{question_text}")
        return template.format(
            current_quiz_number=self.current_quiz_index + 1,
            total_quizzes=len(self.current_quizzes),
            question_text=current_quiz['question_text']
        )

    async def process_answer(self, user_answer: str) -> tuple[str, dict | None]:
        """
        사용자 답변을 처리하고 (응답 메시지, DB에 저장할 결과 데이터)를 반환합니다.
        """
        if not self.is_quiz_active:
            return "지금은 퀴즈 진행 중이 아니에요.", None

        current_quiz = self.current_quizzes[self.current_quiz_index]
        correct_answer = str(current_quiz['answer'])
        
        feedback_text, is_correct = await self._get_feedback_and_correctness(current_quiz, user_answer, correct_answer)

        # DB에 저장할 결과 데이터 생성
        result_to_save = {
            "user_id": self.user_id,
            "quiz_id": current_quiz['id'],
            "question_text": current_quiz['question_text'],
            "user_answer": user_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "quiz_session_id": self.current_quiz_session_id
        }

        self.current_quiz_index += 1
        
        # 다음 문제 또는 최종 결과 메시지 생성
        next_message = self._get_next_message()
        final_response = f"{feedback_text}\n{next_message}"
        
        return final_response, result_to_save

    async def _get_feedback_and_correctness(self, current_quiz, user_answer, correct_answer) -> tuple[str, bool]:
        """LLM 또는 규칙 기반으로 피드백과 정답 여부를 결정합니다."""
        is_correct = False
        if self.llm_module:
            feedback_text, is_correct = await self.llm_module.get_quiz_feedback(
                question=current_quiz['question_text'],
                user_answer=user_answer,
                correct_answer=correct_answer
            )
            if is_correct:
                self.correct_answers_count += 1
            return feedback_text, is_correct
        else: # LLM 없을 때의 기본 로직
            if str(user_answer).strip().lower() == correct_answer.strip().lower():
                is_correct = True
                self.correct_answers_count += 1
                return random.choice(self.quiz_prompts.get('quiz_correct_feedback', ["정답!"])), True
            else:
                feedback = random.choice(self.quiz_prompts.get('quiz_incorrect_feedback', ["아쉽네요."]))
                return feedback.format(correct_answer=correct_answer), False

    def _get_next_message(self) -> str:
        """다음 문제 또는 퀴즈 종료 메시지를 반환합니다."""
        if self.current_quiz_index < len(self.current_quizzes):
            next_question_prompt = random.choice(self.quiz_prompts.get('quiz_continue_prompt', ["다음 문제!"]))
            return f"{next_question_prompt} {self._get_current_question_text()}"
        else:
            self.is_quiz_active = False
            summary_msg = self.quiz_prompts.get('quiz_end_summary', "{total_quizzes}개 중 {correct_count}개를 맞혔어요.")
            return summary_msg.format(
                total_quizzes=len(self.current_quizzes),
                correct_count=self.correct_answers_count
            )

    def stop_quiz(self) -> str:
        """퀴즈를 중단하고 상태를 초기화합니다."""
        if self.is_quiz_active:
            self.is_quiz_active = False
            return "네, 알겠습니다. 퀴즈를 마칠게요."
        return "지금은 퀴즈 진행 중이 아니에요."

    def is_active(self) -> bool:
        """퀴즈 진행 상태를 반환합니다."""
        return self.is_quiz_active