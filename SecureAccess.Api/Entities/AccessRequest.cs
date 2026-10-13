namespace SecureAccess.Api.Entities;

public class AccessRequest
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public int ManagedApplicationId { get; set; }

    public string RequestedRole { get; set; } = string.Empty;

    public string BusinessJustification { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending";

    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ReviewedAtUtc { get; set; }

    public int? ReviewedByEmployeeId { get; set; }

    public string? ReviewComments { get; set; }

    public Employee Employee { get; set; } = null!;

    public ManagedApplication Application { get; set; } = null!;

    public Employee? ReviewedByEmployee { get; set; }
}