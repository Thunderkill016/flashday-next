/** User-facing recovery guidance; never persist provider credentials from upstream errors. */
export function describeImportError(error: unknown, lang = 'en'): string {
  const zh = lang === 'zh';
  const vi = lang === 'vi';
  const raw = error instanceof Error ? error.message : String(error || 'Import failed');
  if (/URL automatic retries exhausted/i.test(raw))
    return zh
      ? '自动重试后仍无法下载来源资料，或网站要求等待更久。请打开原链接，手动下载文件后使用“上传文件”，也可粘贴正文。原链接已保留。'
      : vi
        ? 'Tự động thử lại vẫn không tải được tài liệu, hoặc trang yêu cầu chờ lâu hơn. Mở liên kết gốc, tải tệp thủ công rồi dùng Tải tệp lên; hoặc dán văn bản. Liên kết gốc được giữ lại.'
        : 'Automatic retries could not download this material, or the website requires a longer wait. Open the original link, download the file manually, then use Upload file; or paste the text. Your source URL is retained.';
  if (/\b402\b|insufficient.*(?:credit|balance)/i.test(raw))
    return zh
      ? '服务商余额不足（402）。请检查服务商账户余额及音频转写的最低余额要求后重试。原文件已保留，也可补充文本或字幕。'
      : vi
        ? 'Số dư nhà cung cấp không đủ (402). Kiểm tra số dư tài khoản và mức tối thiểu cho trích ghi audio rồi thử lại. Tệp gốc được giữ; bạn cũng có thể bổ sung văn bản hoặc phụ đề.'
        : 'Provider balance is insufficient (402). Check your provider balance and minimum audio balance requirement, then retry. Your original is retained; you can also attach text or subtitles.';
  if (/Failed to fetch (?:page|PDF|text file) \(40[13]\)/i.test(raw))
    return zh
      ? '来源网站拒绝访问。请打开原链接确认访问权限，或上传已下载的文件；原链接已保留。'
      : vi
        ? 'Trang nguồn từ chối truy cập. Kiểm tra quyền truy cập liên kết gốc, hoặc tải lên tệp đã tải sẵn. Liên kết gốc được giữ lại.'
        : 'The source website denied access. Check access to the original link, or upload a downloaded file. Your source URL is retained.';
  if (/forbidden|\b403\b/i.test(raw))
    return zh
      ? '服务商或网络网关拒绝了请求（403），这不能证明密钥无效。请检查设置中的服务商权限及网络访问，或联系服务商并提供请求编号。原资料已保留。'
      : vi
        ? 'Nhà cung cấp hoặc cổng mạng từ chối yêu cầu (403) — chưa chứng minh được khoá sai. Kiểm tra quyền nhà cung cấp trong Cài đặt và kết nối mạng, hoặc liên hệ nhà cung cấp kèm mã yêu cầu. Tài liệu gốc được giữ.'
        : 'The provider or network gateway denied the request (403). This does not prove the key is invalid. Check provider permissions in Settings and network access, or contact the provider with the request ID. Your original is retained.';
  if (/forbidden|unauthorized|API key|\b40[13]\b|invalid.*key/i.test(raw))
    return zh
      ? '服务商拒绝了请求。请在设置中检查 Groq / OpenAI / OpenRouter 密钥及权限后重试，也可补充文本或 SRT / VTT 字幕。原文件已保留。'
      : vi
        ? 'Nhà cung cấp từ chối yêu cầu. Kiểm tra khoá Groq / OpenAI / OpenRouter và quyền trong Cài đặt rồi thử lại; hoặc bổ sung văn bản / phụ đề SRT / VTT. Tệp gốc được giữ.'
        : 'The provider rejected this request. Check your Groq / OpenAI / OpenRouter key and permissions in Settings, then retry; or add text / SRT / VTT subtitles. Your original is retained.';
  if (/fetch failed|failed to fetch|network|ECONN|ENOTFOUND|TLS|timeout|timed out|abort.*time/i.test(raw))
    return zh
      ? '暂时无法连接来源或服务商。请检查网络后重试；链接也可改用粘贴文本或上传已下载的文件。原资料已保留。'
      : vi
        ? 'Tạm thời không kết nối được nguồn hoặc nhà cung cấp. Kiểm tra mạng rồi thử lại; cũng có thể dùng Dán văn bản hoặc tải lên tệp đã tải sẵn. Tài liệu gốc được giữ.'
        : 'Could not connect to the source or provider. Retry after checking your connection, or use Paste text / upload a downloaded file. Your original is retained.';
  if (/429|rate.?limit|quota/i.test(raw))
    return zh
      ? '服务商额度不足或请求过于频繁，请检查额度并稍后重试。原资料已保留。'
      : vi
        ? 'Nhà cung cấp hết hạn mức hoặc quá nhiều yêu cầu — kiểm tra hạn mức và thử lại sau. Tài liệu gốc được giữ.'
        : 'Provider rate or quota limit reached. Check your quota and retry later. Your original is retained.';
  return raw.replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 1000);
}
