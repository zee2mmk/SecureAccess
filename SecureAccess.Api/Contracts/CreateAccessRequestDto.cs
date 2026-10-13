namespace SecureAccess.Api.Contracts;

public sealed class CreateAccessRequestDto
{
    public int EmployeeId { get; set; }

    public int ManagedApplicationId { get; set; }

    public string RequestedRole { get; set; } = string.Empty;

    public string BusinessJustification { get; set; } = string.Empty;
}
