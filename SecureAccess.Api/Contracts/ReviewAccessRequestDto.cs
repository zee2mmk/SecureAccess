namespace SecureAccess.Api.Contracts;

public sealed class ReviewAccessRequestDto
{
    public int ReviewerEmployeeId { get; set; }

    public string Decision { get; set; } = string.Empty;

    public string? Comments { get; set; }
}
