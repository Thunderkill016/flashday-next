/* Track registry V2 — capability-driven spine, grammar stays support. */
import type { TrackIdV2 } from './types.ts';

export const TRACKS_V2: Record<
  TrackIdV2,
  { title: string; titleVi: string; description: string; descriptionVi: string; scenario: string; icon: string }
> = {
  survival: {
    title: 'Survival English',
    titleVi: 'Tiếng Anh sinh tồn',
    description: 'A0-A1: first conversations — greet, introduce, clarify, request.',
    descriptionVi: 'A0-A1: giao tiếp đầu tiên — chào hỏi, giới thiệu, hỏi lại, yêu cầu.',
    scenario: 'The first things you must be able to say: greetings, introductions, asking for help.',
    icon: '🆘',
  },
  everyday: {
    title: 'Everyday English',
    titleVi: 'Tiếng Anh đời thường',
    description: 'A1-A2: routines, plans, shopping, directions, problems, opinions.',
    descriptionVi: 'A1-A2: thói quen, kế hoạch, mua sắm, chỉ đường, vấn đề, ý kiến.',
    scenario: 'Daily-life talk: schedules, errands, small problems, opinions.',
    icon: '🏠',
  },
  chunks: {
    title: 'High-Frequency Chunks',
    titleVi: 'Cụm câu tần suất cao',
    description: 'Formulaic sequences retrieved whole — hedges, frames, transitions.',
    descriptionVi: 'Cụm câu mẫu nhớ nguyên khối — mở đầu, giảm nhẹ, chuyển ý.',
    scenario: 'Chunks that remove assembly effort mid-conversation.',
    icon: '🧩',
  },
  listening: {
    title: 'Listening Decoding',
    titleVi: 'Nghe giải mã',
    description: 'Bottom-up perception: boundaries, weak forms, reductions, connected speech.',
    descriptionVi: 'Nghe từ dưới lên: ranh giới từ, dạng yếu, âm giảm, nối âm.',
    scenario: 'Training the ear to decode fast natural speech before interpreting it.',
    icon: '👂',
  },
  pronunciation: {
    title: 'Pronunciation for Vietnamese Learners',
    titleVi: 'Phát âm cho người Việt',
    description: 'VN-specific contrasts: final consonants, clusters, /θ/, tense-lax vowels.',
    descriptionVi: 'Cặp âm riêng của người Việt: âm cuối, cụm phụ âm, /θ/, nguyên âm dài-ngắn.',
    scenario: 'Perception-first contrast training on documented VN error sites.',
    icon: '🗣️',
  },
  'grammar-support': {
    title: 'Grammar in Use',
    titleVi: 'Ngữ pháp vận dụng',
    description: 'Grammar as functional support — the patterns behind the tasks you already do.',
    descriptionVi: 'Ngữ pháp phục vụ giao tiếp — cấu trúc đứng sau các nhiệm vụ đã học.',
    scenario: 'The minimum grammar that unblocks real tasks, anchored to measured VN errors.',
    icon: '🔧',
  },
  developer: {
    title: 'Developer English',
    titleVi: 'Tiếng Anh cho lập trình viên',
    description: 'Authentic work tasks: status, bugs, PRs, incidents, reviews, handoffs.',
    descriptionVi: 'Nhiệm vụ công việc thật: báo tiến độ, báo lỗi, PR, sự cố, review, bàn giao.',
    scenario: 'Communication inside a software team.',
    icon: '💻',
  },
  review: {
    title: 'Recycling Review',
    titleVi: 'Ôn tập luân chuyển',
    description: 'Spaced recycling of earlier language in new situations.',
    descriptionVi: 'Ôn lại ngôn ngữ cũ trong tình huống mới.',
    scenario: 'Nothing new — earlier language returns in changed contexts.',
    icon: '🔁',
  },
};
