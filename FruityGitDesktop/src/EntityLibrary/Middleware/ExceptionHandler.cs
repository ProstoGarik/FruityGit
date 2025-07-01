using Microsoft.AspNetCore.Http;
using System.Net;

namespace EntitiesLibrary.Middleware
{
    public class ExceptionHandler(RequestDelegate requestDelegate)
    {
        private RequestDelegate RequestDelegate { get; } = requestDelegate;

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await RequestDelegate.Invoke(context);
            }
            catch (Exception exception)
            {
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

                await context.Response.WriteAsJsonAsync(new
                {
                    ErrorType = exception.GetType().ToString(),
                    ErrorMessage = exception.Message
                });
            }
        }
    }
}
