/*
 * Learner-facing copy for mission screens — ported from FlashDay's
 * vendored vnext UI (src/vnext/ui/copy.js) so the fork speaks the same
 * Vietnamese-first language. Pure data; kernel semantics live in the
 * vendored modules.
 */

export const PURPOSE_FRAME: Record<string, { label: string; hint: string }> = {
  diagnostic: {
    label: 'Kiểm tra đầu vào',
    hint: 'Cứ trả lời tự nhiên — phần này chỉ để biết bạn đang ở đâu, chưa cần đúng.',
  },
  input: { label: 'Xem mẫu', hint: 'Xem và nghe đoạn hội thoại mẫu.' },
  notice: { label: 'Để ý', hint: 'Để ý câu mới trong mẫu.' },
  retrieval: {
    label: 'Nhớ lại',
    hint: 'Trả lời từ trí nhớ — gợi ý có sẵn nếu bạn cần, nhưng hệ thống sẽ ghi là đã dùng trợ giúp.',
  },
  production: { label: 'Tự nói', hint: 'Tự nói câu của bạn.' },
  interaction: {
    label: 'Hội thoại',
    hint: 'Đáp lại lượt của bạn trong cuộc trò chuyện.',
  },
  remediation: {
    label: 'Ôn lại',
    hint: 'Xem kỹ mẫu rồi thử lại — lần thử này được ghi là có hỗ trợ.',
  },
  delayed_retrieval: {
    label: 'Sau một khoảng nghỉ',
    hint: 'Bạn còn nhớ không? Trả lời mà không xem lại bài cũ.',
  },
  transfer: {
    label: 'Tình huống mới',
    hint: 'Hoàn cảnh khác với lúc luyện — vận dụng thử.',
  },
  assessment: {
    label: 'Kiểm tra cuối',
    hint: 'Làm hoàn toàn một mình — kết quả được giữ lại làm mốc đánh giá.',
  },
  support: {
    label: 'Luyện phần nền',
    hint: 'Phần trước cần một kỹ năng nhỏ hơn — luyện nhanh phần này rồi quay lại bài chính.',
  },
};

export const FUNCTION_HINT: Record<string, string> = {
  greet: 'Bắt đầu bằng “H…”',
  ask_name: 'Câu hỏi có “What is your …”',
  state_own_name: '“I’m …” + tên của bạn',
  ask_repeat: 'Chỉ cần “S…?” hoặc “Can you repeat …”',
  respond_to_introduction: '“Nice to meet you …”',
  signal_nonunderstanding: '“I don’t …”',
  understand_identity_question: 'Người kia đang hỏi gì?',
};

export const FUNCTION_MODEL: Record<string, string> = {
  greet: 'Hi!',
  ask_name: "What's your name?",
  state_own_name: "I'm <name>.",
  ask_repeat: 'Sorry?',
  respond_to_introduction: 'Nice to meet you too.',
  signal_nonunderstanding: "I don't understand.",
};

export const modelFor = (functions: string[], learnerName: string | null) =>
  functions
    .map((fn) => FUNCTION_MODEL[fn] ?? null)
    .filter((m): m is string => m != null)
    .map((m) => m.split('<name>').join(learnerName ?? '…'));

export const SUPPORT_LABEL: Record<string, string> = {
  hint: 'Gợi ý',
  modelAnswer: 'Xem mẫu',
  transcript: 'Hiện phần chữ',
  translation: 'Dịch',
  repeat: 'Nghe lại',
};

export const CAP_LABEL: Record<string, string> = {
  'reception.listen.greeting_basic': 'Nghe lời chào',
  'reception.listen.identity_question_basic': 'Nghe câu hỏi tên',
  'production.speak.say_own_name': 'Nói tên của mình',
  'interaction.ask_name': 'Hỏi tên người khác',
  'interaction.respond_to_introduction': 'Đáp lại lời giới thiệu',
};

export const STATE_LABEL: Record<string, string> = {
  NOT_SEEN: 'Chưa học',
  EXPOSED: 'Đã tiếp xúc',
  SUPPORTED: 'Làm được (có hỗ trợ)',
  INDEPENDENT: 'Tự làm được',
  RETAINED: 'Nhớ được',
  TRANSFERRED: 'Vận dụng hoàn cảnh mới',
  FLUENT: 'Thành thạo',
};
