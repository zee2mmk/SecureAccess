namespace SecureAccess.Api.Entities;

public class Employee
{
    public int Id { get; set; }

    public string EmployeeNumber { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    // Object ID of the employee's Microsoft Entra account.
    // Null until an account is explicitly linked.
    public string? EntraObjectId { get; set; }

    public bool IsActive { get; set; } = true;

    public bool CanReviewAccessRequests { get; set; } = false;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}