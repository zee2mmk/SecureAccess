var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("SecureAccessFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("SecureAccessFrontend");

app.MapGet("/api/health", () => Results.Ok(new
{
    application = "SecureAccess",
    status = "Healthy",
    version = "1.0.0"
}));

app.MapGet("/api/access-requests", () =>
{
    var requests = new[]
    {
        new
        {
            id = 1001,
            employee = "Ken Tumamak",
            application = "Finance Portal",
            role = "Director",
            status = "Pending"
        },
        new
        {
            id = 1002,
            employee = "Wendy Tumamak",
            application = "HR Portal",
            role = "HRManager",
            status = "Approved"
        },
        new
        {
            id = 1003,
            employee = "Zee Tumamak",
            application = "Engineering Portal",
            role = "TechLead",
            status = "Approved"
        },
        new
        {
            id = 1004,
            employee = "Solo Tumamak",
            application = "Engineering Portal",
            role = "Developer",
            status = "Pending"
        },
        new
        {
            id = 1005,
            employee = "Arielle Tumamak",
            application = "Finance Portal",
            role = "ReadOnly",
            status = "Pending"
        },
        new
        {
            id = 1006,
            employee = "Wyn Tumamak",
            application = "Engineering Portal",
            role = "Developer",
            status = "Pending"
        },
        new
        {
            id = 1007,
            employee = "Zia Tumamak",
            application = "HR Portal",
            role = "ReadOnly",
            status = "Pending"
        }
    };

    return Results.Ok(requests);
});

app.Run();